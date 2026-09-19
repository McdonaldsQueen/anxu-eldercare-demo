import { Fragment, type ReactNode } from 'react'

const MARKDOWN_LINK = /\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\)/g

export function safeMessageParts(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  let cursor = 0
  let match: RegExpExecArray | null
  MARKDOWN_LINK.lastIndex = 0
  while ((match = MARKDOWN_LINK.exec(text))) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index))
    try {
      const url = new URL(match[2])
      if (url.protocol !== 'https:') throw new Error('unsafe protocol')
      parts.push(
        <a key={`${match.index}-${url.href}`} href={url.href} target="_blank" rel="noopener noreferrer">
          {match[1]}
        </a>,
      )
    } catch {
      parts.push(match[0])
    }
    cursor = match.index + match[0].length
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

export function SafeMessageText({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <p>
      {lines.map((line, index) => (
        <Fragment key={`${index}-${line.slice(0, 12)}`}>
          {index > 0 && <br />}
          {safeMessageParts(line)}
        </Fragment>
      ))}
    </p>
  )
}
