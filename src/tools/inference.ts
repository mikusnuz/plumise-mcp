import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { PlumiseConfig } from '../config.js'
import { getAccount } from '../client.js'

export function registerInferenceTools(server: McpServer, config: PlumiseConfig) {
  server.tool(
    'inference',
    'Send an AI inference request to the Plumise network',
    {
      model: z.string().optional().default('default').describe('Model name'),
      prompt: z.string().describe('The prompt to send'),
      max_tokens: z.number().optional().default(512).describe('Maximum tokens to generate'),
      temperature: z.number().optional().default(0.7).describe('Sampling temperature'),
    },
    async ({ model, prompt, max_tokens, temperature }) => {
      const account = getAccount()
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const message = `inference:${account.address}:${model}:${timestamp}`
      const signature = await account.signMessage({ message })

      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60_000)

      try {
        const res = await fetch(`${config.inferenceApiUrl}/api/v1/inference/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Agent-Address': account.address,
            'X-Agent-Signature': signature,
            'X-Agent-Timestamp': timestamp,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens,
            temperature,
            stream: false,
          }),
          signal: controller.signal,
        })

        if (!res.ok) {
          const text = await res.text()
          return { content: [{ type: 'text', text: `Inference API error (${res.status}): ${text}` }], isError: true }
        }

        const data = await res.json() as {
          choices?: Array<{ message?: { content?: string } }>
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
        }

        const reply = data.choices?.[0]?.message?.content || '(empty response)'
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              model,
              response: reply,
              ...(data.usage ? { usage: data.usage } : {}),
            }, null, 2),
          }],
        }
      } finally {
        clearTimeout(timeout)
      }
    },
  )

  server.tool(
    'model_status',
    'Check available AI models on the Plumise inference network',
    { model: z.string().optional().describe('Specific model name (omit for all)') },
    async ({ model }) => {
      const url = model
        ? `${config.inferenceApiUrl}/api/v1/models/${encodeURIComponent(model)}`
        : `${config.inferenceApiUrl}/api/v1/models`

      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
      if (!res.ok) {
        return { content: [{ type: 'text', text: `API error (${res.status}): ${await res.text()}` }], isError: true }
      }

      const data = await res.json()
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      }
    },
  )
}
