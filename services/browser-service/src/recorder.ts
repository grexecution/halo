type StepType = 'click' | 'type' | 'navigate' | 'scroll'

interface RecordedStep {
  type: StepType
  selector?: string | undefined
  text?: string | undefined
  url?: string | undefined
}

interface RecordedSkill {
  name: string
  steps: RecordedStep[]
  recordedAt: string
}

interface ReplayResult {
  success: boolean
  stepsExecuted: number
}

interface SkillRecorderOptions {
  dryRun?: boolean | undefined
}

export class SkillRecorder {
  private dryRun: boolean
  private recording = false
  private currentName = ''
  private steps: RecordedStep[] = []

  constructor(opts: SkillRecorderOptions = {}) {
    this.dryRun = opts.dryRun ?? false
  }

  startRecording(name: string): void {
    this.recording = true
    this.currentName = name
    this.steps = []
  }

  isRecording(): boolean {
    return this.recording
  }

  recordClick(selector: string): void {
    if (!this.recording) return
    this.steps.push({ type: 'click', selector })
  }

  recordType(selector: string, text: string): void {
    if (!this.recording) return
    this.steps.push({ type: 'type', selector, text })
  }

  recordNavigate(url: string): void {
    if (!this.recording) return
    this.steps.push({ type: 'navigate', url })
  }

  stopRecording(): RecordedSkill {
    this.recording = false
    const skill: RecordedSkill = {
      name: this.currentName,
      steps: [...this.steps],
      recordedAt: new Date().toISOString(),
    }
    this.steps = []
    return skill
  }

  async replay(skill: RecordedSkill): Promise<ReplayResult> {
    if (!this.dryRun) {
      throw new Error('Real replay requires Playwright — use dryRun: true for tests')
    }
    return { success: true, stepsExecuted: skill.steps.length }
  }
}
