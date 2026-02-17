import { tool } from '@opencode-ai/plugin'
import * as https from 'https'
import * as http from 'http'
import { URL } from 'url'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

interface IQuotaSnapshotData {
  readonly entitlement: number
  readonly overage_count: number
  readonly overage_permitted: boolean
  readonly percent_remaining: number
  readonly remaining: number
  readonly unlimited: boolean
}

interface IEntitlementsData {
  readonly copilot_plan: string
  readonly quota_snapshots?: {
    chat?: IQuotaSnapshotData
    completions?: IQuotaSnapshotData
    premium_interactions?: IQuotaSnapshotData
  }
}

interface IUsageResult {
  plan: string
  used: number
  total: number
  percentUsed: number
  unlimited: boolean
}

interface IToolArgs {
  authSource?: 'enterprise' | 'public'
}

function capitalizePlanName(plan: string): string {
  return plan
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function fetchData(url: string, token: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'User-Agent': 'OpenCode-Copilot-Usage-Tool'
      }
    }

    const protocol = parsedUrl.protocol === 'https:' ? https : http

    const req = protocol.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data)
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.end()
  })
}

function getApiUrl(enterpriseUrl?: string): string {
  if (!enterpriseUrl) {
    return 'https://api.github.com/copilot_internal/user'
  }

  const parsedUrl = new URL(`https://${enterpriseUrl}`)
  return `${parsedUrl.protocol}//api.${parsedUrl.hostname}${parsedUrl.port ? ':' + parsedUrl.port : ''}/copilot_internal/user`
}

async function logMessage(context: any, level: string, message: string, extra?: any) {
  try {
    if (context?.client?.app?.log) {
      await context.client.app.log({
        body: {
          service: 'copilot-usage-tool',
          level,
          message,
          extra
        }
      })
    }
  } catch (error) {
    // Silently fail if logging is not available
  }
}

async function getAuthToken(
  preferredSource: 'enterprise' | 'public' | undefined,
  context: any
): Promise<{ token: string; enterpriseUrl?: string; source: string }> {
  await logMessage(context, 'debug', 'Getting authentication token', { preferredSource })

  const envToken = process.env.GITHUB_TOKEN
  if (envToken) {
    await logMessage(context, 'info', 'Using token from GITHUB_TOKEN environment variable')
    return { token: envToken, source: 'env' }
  }

  const authFilePath = path.join(os.homedir(), '.local', 'share', 'opencode', 'auth.json')

  if (!fs.existsSync(authFilePath)) {
    throw new Error('Authentication not found. Set GITHUB_TOKEN env var or authenticate with OpenCode')
  }

  const authData = JSON.parse(fs.readFileSync(authFilePath, 'utf8'))
  const enterpriseAuth = authData['github-copilot-enterprise']
  const publicAuth = authData['github-copilot']

  const hasEnterprise = enterpriseAuth && enterpriseAuth.access
  const hasPublic = publicAuth && publicAuth.access

  if (!hasEnterprise && !hasPublic) {
    throw new Error('GitHub Copilot authentication not found in auth.json')
  }

  if (hasEnterprise && hasPublic) {
    const source = preferredSource === 'enterprise' ? 'enterprise' : 'public'
    const selectedAuth = source === 'enterprise' ? enterpriseAuth : publicAuth

    await logMessage(context, 'info', `Using ${source} authentication (both available, default: public)`, { preferredSource, source })

    return {
      token: selectedAuth.access,
      enterpriseUrl: selectedAuth.enterpriseUrl,
      source
    }
  }

  const source = hasEnterprise ? 'enterprise' : 'public'
  const selectedAuth = hasEnterprise ? enterpriseAuth : publicAuth

  await logMessage(context, 'info', `Using ${source} authentication (only one available)`, { source })

  return {
    token: selectedAuth.access,
    enterpriseUrl: selectedAuth.enterpriseUrl,
    source
  }
}

async function fetchUsageData(context: any, args: IToolArgs): Promise<IUsageResult> {
  const { token, enterpriseUrl, source } = await getAuthToken(args.authSource, context)

  await logMessage(context, 'debug', 'Fetching usage data', { source, hasEnterpriseUrl: !!enterpriseUrl })

  const apiUrl = getApiUrl(enterpriseUrl)
  const responseText = await fetchData(apiUrl, token)
  const entitlements: IEntitlementsData = JSON.parse(responseText)

  const planName = capitalizePlanName(entitlements.copilot_plan)

  if (!entitlements.quota_snapshots?.premium_interactions) {
    throw new Error(`Premium requests not available for ${planName} plan`)
  }

  const quota = entitlements.quota_snapshots.premium_interactions

  if (quota.unlimited) {
    return {
      plan: planName,
      used: 0,
      total: 0,
      percentUsed: 0,
      unlimited: true
    }
  }

  const used = quota.entitlement - quota.remaining
  const percentUsed = 100 - quota.percent_remaining

  return {
    plan: planName,
    used,
    total: quota.entitlement,
    percentUsed,
    unlimited: false
  }
}

function formatMarkdown(result: IUsageResult): string {
  if (result.unlimited) {
    return `# Copilot ${result.plan} Usage\n\nPremium requests: unlimited`
  }

  return `# Copilot ${result.plan} Usage\n\nPremium requests: ${result.used}/${result.total} (${result.percentUsed.toFixed(2)}%)`
}

export default tool({
  description: 'Fetch and display GitHub Copilot usage quota information',
  args: {
    authSource: tool.schema
      .enum(['enterprise', 'public'])
      .optional()
      .describe('Authentication source preference (default: public if both available, otherwise use what is available)')
  },
  async execute(args, context) {
    await logMessage(context, 'debug', 'Executing copilot-usage tool', { authSource: args.authSource })

    try {
      const result = await fetchUsageData(context, args)

      await logMessage(context, 'info', 'Successfully fetched usage data', { plan: result.plan, used: result.used, total: result.total, percentUsed: result.percentUsed })

      return formatMarkdown(result)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      await logMessage(context, 'error', 'Failed to fetch usage data', { error: errorMessage })

      return `# Copilot Usage Error\n\nError: ${errorMessage}`
    }
  }
})
