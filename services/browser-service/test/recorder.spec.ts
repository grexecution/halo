/**
 * F-106: Browser-automation skill recorder
 */
import { describe, it, expect } from 'vitest'
import { SkillRecorder } from '../src/recorder.js'

describe('F-106: Browser-automation skill recorder', () => {
  it('starts recording a skill', () => {
    const recorder = new SkillRecorder({ dryRun: true })
    recorder.startRecording('login-flow')
    expect(recorder.isRecording()).toBe(true)
  })

  it('records click and type events', () => {
    const recorder = new SkillRecorder({ dryRun: true })
    recorder.startRecording('test-skill')
    recorder.recordClick('#username')
    recorder.recordType('#username', 'admin')
    recorder.recordClick('#submit')
    const skill = recorder.stopRecording()
    expect(skill.steps).toHaveLength(3)
  })

  it('stops recording and returns skill', () => {
    const recorder = new SkillRecorder({ dryRun: true })
    recorder.startRecording('my-skill')
    const skill = recorder.stopRecording()
    expect(skill.name).toBe('my-skill')
    expect(recorder.isRecording()).toBe(false)
  })

  it('replays a recorded skill', async () => {
    const recorder = new SkillRecorder({ dryRun: true })
    recorder.startRecording('replay-skill')
    recorder.recordClick('#login-btn')
    const skill = recorder.stopRecording()
    const result = await recorder.replay(skill)
    expect(result.success).toBe(true)
    expect(result.stepsExecuted).toBe(1)
  })
})
