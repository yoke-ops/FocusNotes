/**
 * 可替换的集成接口。
 *
 * 云同步已改为 Gitee Git 方案（见 gitee.ts），原微信登录/微信云同步占位接口已移除。
 */

export interface SmartParserProvider {
  parse(input: string, now?: Date): Promise<import('./types').ParsedTodoDraft>
}

export class IntegrationRequiredError extends Error {
  constructor(feature: string) {
    super(`${feature}尚未配置，请先接入正式服务。`)
    this.name = 'IntegrationRequiredError'
  }
}
