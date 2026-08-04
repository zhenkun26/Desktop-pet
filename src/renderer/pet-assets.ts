/** 按素材文件名解析打包后的资源 URL（vite 会为每个文件生成哈希 URL）。 */
const assetModules = import.meta.glob('./assets/*.png', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>

/**
 * 解析角色素材的资源 URL。
 *
 * @param assetFileName 注册表中的素材文件名（如 hutao.png）
 * @returns 打包后的资源 URL；未找到时返回 null（调用方回退到默认素材）
 */
export function resolvePetAssetUrl(assetFileName: string): string | null {
  const url = assetModules[`./assets/${assetFileName}`]
  return url ?? null
}
