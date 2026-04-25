import type { ReactNode } from 'react'
import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from '@/components/assistant-ui/attachment'
import { MarkdownText } from '@/components/assistant-ui/markdown-text'
import { ToolFallback } from '@/components/assistant-ui/tool-fallback'
import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button'
import { Reasoning, ReasoningGroup } from '@/components/assistant-ui/reasoning'
import { SettingsChangeCard } from '@/app/components/assistant-ui/settings-change-card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  ActionBarMorePrimitive,
  ActionBarPrimitive,
  AuiIf,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  SuggestionPrimitive,
  ThreadPrimitive,
  useAuiState,
} from '@assistant-ui/react'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RefreshCwIcon,
  SquareIcon,
  SparklesIcon,
} from 'lucide-react'
import type { FC } from 'react'

// ── Assistant avatar ─────────────────────────────────────────────────────────

const AssistantAvatar: FC<{ className?: string }> = ({ className }) => (
  <div
    className={cn(
      'flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-white shadow-md',
      className,
    )}
  >
    <SparklesIcon className="size-3.5" />
  </div>
)

// ── Thread root ───────────────────────────────────────────────────────────────

export const Thread: FC<{ agentPicker?: ReactNode }> = ({ agentPicker }) => {
  return (
    <ThreadPrimitive.Root
      className="aui-root aui-thread-root @container flex h-full flex-col bg-background"
      style={{
        ['--thread-max-width' as string]: '52rem',
        ['--composer-radius' as string]: '20px',
        ['--composer-padding' as string]: '8px',
      }}
    >
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        data-slot="aui_thread-viewport"
        className="relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth"
      >
        <div className="mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-4 pt-4">
          <AuiIf condition={(s) => s.thread.isEmpty}>
            <ThreadWelcome />
          </AuiIf>

          <div data-slot="aui_message-group" className="mb-10 flex flex-col gap-y-6 empty:hidden">
            <ThreadPrimitive.Messages>{() => <ThreadMessage />}</ThreadPrimitive.Messages>
          </div>

          <ThreadPrimitive.ViewportFooter className="aui-thread-viewport-footer sticky bottom-0 mt-auto flex flex-col gap-4 overflow-visible rounded-t-(--composer-radius) bg-background pb-4 md:pb-6">
            <ThreadScrollToBottom />
            <Composer agentPicker={agentPicker} />
          </ThreadPrimitive.ViewportFooter>
        </div>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  )
}

const ThreadMessage: FC = () => {
  const role = useAuiState((s) => s.message.role)
  const isEditing = useAuiState((s) => s.message.composer.isEditing)

  if (isEditing) return <EditComposer />
  if (role === 'user') return <UserMessage />
  return <AssistantMessage />
}

// ── Scroll to bottom ─────────────────────────────────────────────────────────

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="outline"
        className="aui-thread-scroll-to-bottom absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible dark:border-border dark:bg-background dark:hover:bg-accent"
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  )
}

// ── Welcome screen ────────────────────────────────────────────────────────────

const ThreadWelcome: FC = () => {
  return (
    <div className="aui-thread-welcome-root my-auto flex grow flex-col">
      <div className="aui-thread-welcome-center flex w-full grow flex-col items-center justify-center gap-8">
        {/* Avatar + greeting */}
        <div className="flex flex-col items-center gap-5 animate-fade-in">
          {/* Glow orb */}
          <div className="relative">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 blur-xl opacity-40 animate-breathe" />
            <div className="relative flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 shadow-xl shadow-indigo-900/30">
              <SparklesIcon className="size-9 text-white" />
            </div>
          </div>
          <div className="text-center">
            <h1 className="fade-in slide-in-from-bottom-1 animate-in fill-mode-both font-bold text-3xl text-foreground duration-300 tracking-tight">
              Hey, I&apos;m Halo
            </h1>
            <p className="fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-muted-foreground text-base delay-100 duration-300 mt-2 max-w-sm">
              Your autonomous AI agent — here to think, act, and remember for you.
            </p>
          </div>
        </div>

        {/* Suggestions grid */}
        <div className="w-full max-w-lg animate-fade-in" style={{ animationDelay: '150ms' }}>
          <ThreadSuggestions />
        </div>
      </div>
    </div>
  )
}

const ThreadSuggestions: FC = () => {
  return (
    <div className="aui-thread-welcome-suggestions grid w-full @md:grid-cols-2 gap-2 pb-4">
      <ThreadPrimitive.Suggestions>{() => <ThreadSuggestionItem />}</ThreadPrimitive.Suggestions>
    </div>
  )
}

const ThreadSuggestionItem: FC = () => {
  return (
    <div className="aui-thread-welcome-suggestion-display fade-in slide-in-from-bottom-2 @md:nth-[n+3]:block nth-[n+3]:hidden animate-in fill-mode-both duration-200">
      <SuggestionPrimitive.Trigger send asChild>
        <Button
          variant="ghost"
          className="aui-thread-welcome-suggestion h-auto w-full @md:flex-col flex-wrap items-start justify-start gap-1 rounded-2xl border border-border/60 bg-background/60 hover:bg-muted/80 hover:border-border px-4 py-3 text-left text-sm transition-all duration-150 backdrop-blur-sm"
        >
          <SuggestionPrimitive.Title className="aui-thread-welcome-suggestion-text-1 font-medium text-foreground" />
          <SuggestionPrimitive.Description className="aui-thread-welcome-suggestion-text-2 text-muted-foreground text-xs empty:hidden" />
        </Button>
      </SuggestionPrimitive.Trigger>
    </div>
  )
}

// ── Composer ──────────────────────────────────────────────────────────────────

const Composer: FC<{ agentPicker?: ReactNode }> = ({ agentPicker }) => {
  return (
    <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col gap-2">
      {/* ── Input area with border ── */}
      <ComposerPrimitive.AttachmentDropzone asChild>
        <div
          data-slot="aui_composer-shell"
          className="flex w-full flex-col rounded-(--composer-radius) border border-border/80 bg-background px-3 pt-3 pb-2 shadow-sm transition-all duration-150 focus-within:border-ring/60 focus-within:ring-2 focus-within:ring-ring/15 focus-within:shadow-md data-[dragging=true]:border-ring data-[dragging=true]:border-dashed data-[dragging=true]:bg-accent/50"
        >
          <ComposerAttachments />
          <ComposerPrimitive.Input
            placeholder="Message Halo…"
            className="aui-composer-input max-h-40 min-h-[2.5rem] w-full resize-none bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground/60 leading-relaxed"
            rows={1}
            autoFocus
            aria-label="Message input"
          />
        </div>
      </ComposerPrimitive.AttachmentDropzone>

      {/* ── Toolbar row below the input ── */}
      <ComposerAction agentPicker={agentPicker} />
    </ComposerPrimitive.Root>
  )
}

const ComposerAction: FC<{ agentPicker?: ReactNode }> = ({ agentPicker }) => {
  return (
    <div className="aui-composer-action-wrapper flex items-center justify-between px-1">
      <div className="flex items-center gap-2">
        <ComposerAddAttachment />
        {agentPicker ?? (
          <span className="hidden @sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/60 border border-border/40 text-[10px] text-muted-foreground font-medium select-none">
            <SparklesIcon className="size-2.5" />
            Greg Agent
          </span>
        )}
      </div>
      <AuiIf condition={(s) => !s.thread.isRunning}>
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            tooltip="Send message"
            side="bottom"
            type="button"
            variant="default"
            size="icon"
            className="aui-composer-send size-8 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-md shadow-indigo-900/30 transition-all duration-150 hover:scale-105 hover:shadow-lg hover:shadow-indigo-900/40 disabled:opacity-40 disabled:hover:scale-100"
            aria-label="Send message"
          >
            <ArrowUpIcon className="aui-composer-send-icon size-4" />
          </TooltipIconButton>
        </ComposerPrimitive.Send>
      </AuiIf>
      <AuiIf condition={(s) => s.thread.isRunning}>
        <ComposerPrimitive.Cancel asChild>
          <Button
            type="button"
            variant="default"
            size="icon"
            className="aui-composer-cancel size-8 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white"
            aria-label="Stop generating"
          >
            <SquareIcon className="aui-composer-cancel-icon size-3 fill-current" />
          </Button>
        </ComposerPrimitive.Cancel>
      </AuiIf>
    </div>
  )
}

// ── Message error ─────────────────────────────────────────────────────────────

const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="aui-message-error-root mt-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-destructive text-sm dark:bg-destructive/5 dark:text-red-300">
        <ErrorPrimitive.Message className="aui-message-error-message line-clamp-3" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  )
}

// ── Assistant message ─────────────────────────────────────────────────────────

const AssistantMessage: FC = () => {
  const ACTION_BAR_PT = 'pt-1.5'
  const ACTION_BAR_HEIGHT = `-mb-7.5 min-h-7.5 ${ACTION_BAR_PT}`

  return (
    <MessagePrimitive.Root
      data-slot="aui_assistant-message-root"
      data-role="assistant"
      className="fade-in slide-in-from-bottom-1 relative animate-in duration-150"
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <AssistantAvatar className="mt-0.5 shrink-0" />

        <div className="flex-1 min-w-0">
          <div
            data-slot="aui_assistant-message-content"
            className="wrap-break-word text-foreground leading-relaxed"
          >
            <MessagePrimitive.Parts
              components={{
                Text: MarkdownText,
                Reasoning,
                ReasoningGroup,
                tools: {
                  Fallback: ToolFallback,
                  by_name: {
                    suggest_settings_change: SettingsChangeCard,
                  },
                },
              }}
            />
            <MessageError />
          </div>

          <div
            data-slot="aui_assistant-message-footer"
            className={cn('flex items-center', ACTION_BAR_HEIGHT)}
          >
            <BranchPicker />
            <AssistantActionBar />
          </div>
        </div>
      </div>
    </MessagePrimitive.Root>
  )
}

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-assistant-action-bar-root col-start-3 row-start-2 -ml-1 flex gap-1 text-muted-foreground"
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="Copy">
          <AuiIf condition={(s) => s.message.isCopied}>
            <CheckIcon />
          </AuiIf>
          <AuiIf condition={(s) => !s.message.isCopied}>
            <CopyIcon />
          </AuiIf>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip="Regenerate">
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
      <ActionBarMorePrimitive.Root>
        <ActionBarMorePrimitive.Trigger asChild>
          <TooltipIconButton tooltip="More" className="data-[state=open]:bg-accent">
            <MoreHorizontalIcon />
          </TooltipIconButton>
        </ActionBarMorePrimitive.Trigger>
        <ActionBarMorePrimitive.Content
          side="bottom"
          align="start"
          className="aui-action-bar-more-content z-50 min-w-36 overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          <ActionBarPrimitive.ExportMarkdown asChild>
            <ActionBarMorePrimitive.Item className="aui-action-bar-more-item flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground">
              <DownloadIcon className="size-4" />
              Export as Markdown
            </ActionBarMorePrimitive.Item>
          </ActionBarPrimitive.ExportMarkdown>
        </ActionBarMorePrimitive.Content>
      </ActionBarMorePrimitive.Root>
    </ActionBarPrimitive.Root>
  )
}

// ── User message ──────────────────────────────────────────────────────────────

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root
      data-slot="aui_user-message-root"
      className="fade-in slide-in-from-bottom-1 grid animate-in auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 duration-150 [&:where(>*)]:col-start-2"
      data-role="user"
    >
      <UserMessageAttachments />

      <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
        <div className="aui-user-message-content wrap-break-word peer rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-2.5 text-white text-sm empty:hidden leading-relaxed shadow-md shadow-indigo-900/20">
          <MessagePrimitive.Parts />
        </div>
        <div className="aui-user-action-bar-wrapper absolute top-1/2 left-0 -translate-x-full -translate-y-1/2 pr-2 peer-empty:hidden">
          <UserActionBar />
        </div>
      </div>

      <BranchPicker
        data-slot="aui_user-branch-picker"
        className="col-span-full col-start-1 row-start-3 -mr-1 justify-end"
      />
    </MessagePrimitive.Root>
  )
}

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-user-action-bar-root flex flex-col items-end"
    >
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton tooltip="Edit" className="aui-user-action-edit p-4">
          <PencilIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  )
}

// ── Edit composer ─────────────────────────────────────────────────────────────

const EditComposer: FC = () => {
  return (
    <MessagePrimitive.Root data-slot="aui_edit-composer-wrapper" className="flex flex-col px-2">
      <ComposerPrimitive.Root className="aui-edit-composer-root ml-auto flex w-full max-w-[85%] flex-col rounded-2xl bg-muted border border-border/40">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input min-h-14 w-full resize-none bg-transparent p-4 text-foreground text-sm outline-none leading-relaxed"
          autoFocus
        />
        <div className="aui-edit-composer-footer mx-3 mb-3 flex items-center gap-2 self-end">
          <ComposerPrimitive.Cancel asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button size="sm">Update</Button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  )
}

// ── Branch picker ─────────────────────────────────────────────────────────────

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({ className, ...rest }) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        'aui-branch-picker-root mr-2 -ml-2 inline-flex items-center text-muted-foreground text-xs',
        className,
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip="Previous">
          <ChevronLeftIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className="aui-branch-picker-state font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton tooltip="Next">
          <ChevronRightIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  )
}
