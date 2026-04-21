import { intro, outro } from '@clack/prompts'

export async function main(): Promise<void> {
  intro('create-claw-alt')
  outro('Run init to set up your claw-alt instance.')
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal: ${String(err)}\n`)
  process.exit(1)
})
