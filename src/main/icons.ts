import { app, nativeImage, type NativeImage } from 'electron'
import { join } from 'path'

/** 开发时资源在 <root>/resources，打包后在 process.resourcesPath/resources */
function resolveResource(name: string): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'resources', name)
  }
  return join(__dirname, '../../resources', name)
}

export function resolveAppIcon(): NativeImage {
  const img = nativeImage.createFromPath(resolveResource('icon.png'))
  return img
}

export function resolveTrayIcon(): NativeImage {
  const img = nativeImage.createFromPath(resolveResource('tray.png'))
  const resized = img.resize({ width: 18, height: 18 })
  if (process.platform === 'darwin') {
    resized.setTemplateImage(false)
  }
  return resized
}
