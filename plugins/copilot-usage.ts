import type { Plugin } from '@opencode-ai/plugin'

/**
 * Copilot Usage Plugin
 *
 * This plugin enhances the copilot-usage tool by providing hooks
 * for future extensibility. Currently, all functionality is handled
 * by the tool itself.
 *
 * Future enhancements could include:
 * - Caching usage data to reduce API calls
 * - Periodic automatic checks
 * - Integration with other monitoring tools
 */
export const CopilotUsagePlugin: Plugin = async (ctx) => {
  await ctx.client.app.log({
    body: {
      service: 'copilot-usage-plugin',
      level: 'info',
      message: 'Copilot Usage Plugin initialized'
    }
  })

  return {}
}
