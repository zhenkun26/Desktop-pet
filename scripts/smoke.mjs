import { existsSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const REQUIRED_ARTIFACTS = [
  'out/main/index.js',
  'out/preload/index.js',
  'out/renderer/index.html'
]

const CJS_BUNDLES = ['out/main/index.js', 'out/preload/index.js']

for (const file of REQUIRED_ARTIFACTS) {
  if (!existsSync(file) || statSync(file).size === 0) {
    console.error(`[smoke] 构建产物缺失或为空: ${file}`)
    process.exit(1)
  }
}

for (const bundle of CJS_BUNDLES) {
  execFileSync(process.execPath, ['--check', bundle], { stdio: 'pipe' })
}

console.log('[smoke] 构建产物校验通过: main/preload/renderer 均存在且语法合法')
