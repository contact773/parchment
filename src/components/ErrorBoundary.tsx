import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/** Catches render errors so a single broken view doesn't blank the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('Parchment caught an error:', error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 bg-bg p-8 text-center">
          <h1 className="font-serif text-2xl font-semibold text-ink">Something went wrong</h1>
          <pre className="max-w-2xl overflow-auto rounded-lg border border-border bg-surface p-4 text-left text-xs text-danger">
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack?.split('\n').slice(0, 6).join('\n')}
          </pre>
          <div className="flex gap-2">
            <button onClick={this.reset} className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg">
              Try again
            </button>
            <button onClick={() => (location.hash = '#/')} className="rounded-md border border-border px-4 py-2 text-sm">
              Back to projects
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
