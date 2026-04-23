import { describe, it, expect, beforeEach } from 'vitest'
import { ModelRouter, globalModelRouter } from '../src/model-router.js'

describe('ModelRouter', () => {
  let router: ModelRouter

  beforeEach(() => {
    router = new ModelRouter({
      heavyModel: 'heavy-model',
      lightModel: 'light-model',
      litellmUrl: null,
    })
  })

  describe('classify()', () => {
    it('classifies reasoning tasks by keyword', () => {
      expect(router.classify('plan the architecture for a new service')).toBe('reasoning')
      expect(router.classify('implement this complex algorithm')).toBe('reasoning')
      expect(router.classify('debug the failing test')).toBe('reasoning')
    })

    it('classifies formatting tasks by keyword', () => {
      expect(router.classify('format this JSON output')).toBe('formatting')
      expect(router.classify('summarize the meeting notes')).toBe('formatting')
      expect(router.classify('translate to Spanish')).toBe('formatting')
    })

    it('classifies reflection tasks by keyword', () => {
      expect(router.classify('reflect on past tool calls')).toBe('reflection')
      expect(router.classify('learn from this error to improve')).toBe('reflection')
      expect(router.classify('generate a new skill from this procedure')).toBe('reflection')
    })

    it('defaults to "default" for unknown prompts', () => {
      expect(router.classify('hello, how are you?')).toBe('default')
      expect(router.classify('what time is it?')).toBe('default')
    })

    it('prioritises reflection over formatting when both keywords appear', () => {
      // reflection keywords come first in the check order
      expect(router.classify('reflect and summarize')).toBe('reflection')
    })
  })

  describe('route()', () => {
    it('routes reasoning to heavy model', () => {
      const decision = router.route('reasoning')
      expect(decision.modelId).toBe('heavy-model')
      expect(decision.taskType).toBe('reasoning')
    })

    it('routes default to heavy model', () => {
      const decision = router.route('default')
      expect(decision.modelId).toBe('heavy-model')
    })

    it('routes formatting to light model', () => {
      const decision = router.route('formatting')
      expect(decision.modelId).toBe('light-model')
    })

    it('routes reflection to light model', () => {
      const decision = router.route('reflection')
      expect(decision.modelId).toBe('light-model')
    })

    it('sets useLiteLLM=false when no litellmUrl', () => {
      const decision = router.route('reasoning')
      expect(decision.useLiteLLM).toBe(false)
      expect(decision.baseUrl).toBeNull()
    })

    it('sets useLiteLLM=true and baseUrl when litellmUrl is configured', () => {
      const r = new ModelRouter({ litellmUrl: 'http://localhost:4000' })
      const decision = r.route('reasoning')
      expect(decision.useLiteLLM).toBe(true)
      expect(decision.baseUrl).toBe('http://localhost:4000/v1')
    })
  })

  describe('routePrompt()', () => {
    it('classifies and routes in one call', () => {
      const decision = router.routePrompt('please plan the new microservice architecture')
      expect(decision.taskType).toBe('reasoning')
      expect(decision.modelId).toBe('heavy-model')
    })
  })

  describe('buildLiteLLMConfig()', () => {
    it('generates valid YAML containing model names', () => {
      const yaml = router.buildLiteLLMConfig()
      expect(yaml).toContain('model_name: heavy-model')
      expect(yaml).toContain('model_name: light-model')
      expect(yaml).toContain('model_name: ollama-fallback')
    })

    it('includes fallback chain from heavy → light → ollama', () => {
      const yaml = router.buildLiteLLMConfig()
      expect(yaml).toContain('heavy-model: [light-model, ollama-fallback]')
      expect(yaml).toContain('light-model: [ollama-fallback]')
    })
  })

  describe('globalModelRouter', () => {
    it('is exported as a singleton', () => {
      expect(globalModelRouter).toBeInstanceOf(ModelRouter)
    })
  })
})
