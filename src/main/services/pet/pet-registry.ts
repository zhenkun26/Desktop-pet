import { PET_IDS, PET_LABELS, type PetId } from '../../../shared/types'
import type { PetDescriptor, PetGreetings } from '../../../shared/types'
import { BUILTIN_PERSONAS } from '../chat/personas'

/** 胡桃的时段问候文案（原 renderer/main.ts GREETINGS 迁入）。 */
const HUTAO_GREETINGS: PetGreetings = {
  morning: [
    '早上好呀！新的一天，要不要来点「往生堂特价早餐」？嘿嘿，开玩笑的啦～',
    '早～起这么早，是来陪本堂主看日出的吗？',
    '清晨的露水最干净啦！洗漱完了就来找我玩吧～',
    '早上好！今天也要元气满满地「推销」……啊不，是努力哦！'
  ],
  afternoon: [
    '下午好～吃饱了吗？没吃饱的话，胡桃把珍藏的虾饺分你一半！',
    '午后最容易犯困啦，要不要起来活动活动？',
    '下午好呀！今天的阳光真好，适合出去走走，不适合「长眠」哦～',
    '嗯哼，下午茶时间到！你喝什么，我喝……发光的幽幽茶！'
  ],
  evening: [
    '晚上好～天黑了，正是本堂主营业……咳，是陪伴你的时间！',
    '晚上好呀！今天辛苦啦，要不要和我讲讲今天发生的事？',
    '夜幕降临咯，别怕黑，胡桃我可是最专业的「夜路向导」！',
    '晚上好！晚饭吃了吗？没吃的话快去快去，饿着肚子可不行～'
  ],
  night: [
    '这么晚还不睡呀？熬夜的话，小心被本堂主盯上哦……嘿嘿。',
    '夜深啦，早点休息吧，明天醒来我还在这里等你～',
    '深夜的悄悄话时间：其实……你努力的样子，我都看在眼里哦。',
    '困了就快去睡！再不睡，我就要念「催眠诗」给你听啦——嗷！'
  ]
}

/** 内置角色注册表：新增角色时在此登记元数据与素材即可。 */
const PET_REGISTRY: Record<PetId, PetDescriptor> = {
  hutao: {
    petId: 'hutao',
    displayName: PET_LABELS.hutao,
    assetFileName: 'hutao.png',
    coreIdentity: BUILTIN_PERSONAS.hutao.coreIdentity,
    speechStyle: BUILTIN_PERSONAS.hutao.speechStyle,
    greetings: HUTAO_GREETINGS
  }
}

/**
 * 列出全部注册角色。
 *
 * @returns 注册表条目数组（按 PET_IDS 顺序）
 */
export function listPets(): PetDescriptor[] {
  return PET_IDS.map((petId) => PET_REGISTRY[petId])
}

/**
 * 按角色标识查询注册表条目。
 *
 * @param petId 角色标识
 * @returns 该角色的注册表条目
 * @throws 角色未注册时抛出明确错误，调用方不得静默回退
 */
export function getPet(petId: PetId): PetDescriptor {
  const entry = PET_REGISTRY[petId]
  if (!entry) {
    throw new Error(`未注册的角色: ${petId}`)
  }
  return entry
}
