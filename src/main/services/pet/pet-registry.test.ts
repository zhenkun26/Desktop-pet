import { describe, expect, it } from 'vitest'
import { getPet, listPets } from './pet-registry'
import type { PetId } from '../../../shared/types'

describe('pet-registry', () => {
  it('should list the built-in pets', () => {
    const pets = listPets()
    expect(pets).toHaveLength(1)
    expect(pets[0]).toMatchObject({ petId: 'hutao', displayName: '胡桃' })
    expect(pets[0].greetings.morning.length).toBeGreaterThan(0)
  })

  it('should return the registered pet by id', () => {
    expect(getPet('hutao').assetFileName).toBe('hutao.png')
  })

  it('should throw a clear error for unregistered pet ids', () => {
    expect(() => getPet('nope' as PetId)).toThrow('未注册的角色: nope')
  })
})
