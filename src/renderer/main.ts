import { PetController } from './pet'
import type { PetGreetings } from '../shared/types'
import { resolvePetAssetUrl } from './pet-assets'

/**
 * 桌宠窗口入口：
 * - 时段问候（首次加载后延迟说一句）
 * - 业务事件：busy → 持久「思考中」气泡 + 摇晃动画；idle → 恢复
 * - 休息提醒 / 番茄钟完成 → 分段轮播播报
 */

function pickGreeting(greetings: PetGreetings): string {
  const hour = new Date().getHours()
  let bucket: keyof PetGreetings
  if (hour >= 5 && hour < 11) bucket = 'morning'
  else if (hour >= 11 && hour < 18) bucket = 'afternoon'
  else if (hour >= 18 && hour < 23) bucket = 'evening'
  else bucket = 'night'
  const list = greetings[bucket]
  return list[Math.floor(Math.random() * list.length)]
}

async function bootstrap(): Promise<void> {
  const stage = document.getElementById('pet-stage')
  const image = document.getElementById('pet-image') as HTMLImageElement | null
  const bubbleEl = document.getElementById('bubble')
  if (!stage || !image || !bubbleEl) return

  const config = await window.desktopPet.getConfig()
  const petEntry = await window.desktopPet.getPet(config.petId)
  const assetUrl = resolvePetAssetUrl(petEntry.assetFileName)
  if (assetUrl) image.src = assetUrl
  image.alt = petEntry.displayName

  const pet = new PetController(
    stage as HTMLElement,
    image as HTMLImageElement,
    bubbleEl as HTMLButtonElement
  )

  // 时段问候
  setTimeout(() => {
    if (pet.bubble.canShowIdleMessage()) {
      pet.say(pickGreeting(petEntry.greetings))
    }
  }, 1200)

  // AI 生成状态 → busy/idle
  window.desktopPet.onBusinessEvent((event) => {
    if (event.type === 'busy') {
      pet.setBusinessBusy(true)
      pet.say('胡桃正在想……', { persistent: true })
    } else if (event.type === 'idle') {
      pet.setBusinessBusy(false)
      if (!pet.bubble.isMenuOpen()) {
        pet.stopTalking()
      }
    } else if (event.type === 'message') {
      pet.say(event.message, { persistent: event.persistent ?? false })
    }
  })

  // 休息提醒
  window.desktopPet.onRestReminder((event) => {
    pet.say(`已经陪了你 ${event.activeMinutes} 分钟啦！该起来活动一下咯～`)
  })

  // 番茄钟完成
  window.desktopPet.onPomodoroDone((event) => {
    pet.say(event.message)
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void bootstrap()
  })
} else {
  void bootstrap()
}
