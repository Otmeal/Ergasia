import type { ReactNode } from 'react'

export function MarkdownPreview({ source }: { source: string }) {
  const blocks = parseBlocks(source)

  if (blocks.length === 0) {
    return <p className="muted">無 notes。</p>
  }

  return <div className="markdown-preview">{blocks}</div>
}

function parseBlocks(source: string): ReactNode[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (!line.trim()) {
      index += 1
      continue
    }

    if (line.startsWith('```')) {
      const codeLines: string[] = []
      index += 1

      while (index < lines.length && !lines[index].startsWith('```')) {
        codeLines.push(lines[index])
        index += 1
      }

      blocks.push(
        <pre key={`code-${index}`}>
          <code>{codeLines.join('\n')}</code>
        </pre>,
      )
      index += 1
      continue
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line)

    if (heading) {
      const level = heading[1].length
      const content = renderInline(heading[2])

      if (level === 1) {
        blocks.push(<h3 key={`h-${index}`}>{content}</h3>)
      } else if (level === 2) {
        blocks.push(<h4 key={`h-${index}`}>{content}</h4>)
      } else {
        blocks.push(<h5 key={`h-${index}`}>{content}</h5>)
      }

      index += 1
      continue
    }

    if (/^[-*]\s+/.test(line)) {
      const items: ReactNode[] = []

      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        items.push(<li key={`li-${index}`}>{renderInline(lines[index].replace(/^[-*]\s+/, ''))}</li>)
        index += 1
      }

      blocks.push(<ul key={`ul-${index}`}>{items}</ul>)
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: ReactNode[] = []

      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(<li key={`oli-${index}`}>{renderInline(lines[index].replace(/^\d+\.\s+/, ''))}</li>)
        index += 1
      }

      blocks.push(<ol key={`ol-${index}`}>{items}</ol>)
      continue
    }

    const paragraph: string[] = []

    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].startsWith('```') &&
      !/^(#{1,3})\s+/.test(lines[index]) &&
      !/^[-*]\s+/.test(lines[index]) &&
      !/^\d+\.\s+/.test(lines[index])
    ) {
      paragraph.push(lines[index])
      index += 1
    }

    blocks.push(<p key={`p-${index}`}>{renderInline(paragraph.join(' '))}</p>)
  }

  return blocks
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g
  let cursor = 0

  for (const match of text.matchAll(pattern)) {
    if (match.index === undefined) {
      continue
    }

    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index))
    }

    nodes.push(renderToken(match[0], nodes.length))
    cursor = match.index + match[0].length
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor))
  }

  return nodes
}

function renderToken(token: string, key: number): ReactNode {
  if (token.startsWith('**')) {
    return <strong key={key}>{token.slice(2, -2)}</strong>
  }

  if (token.startsWith('*')) {
    return <em key={key}>{token.slice(1, -1)}</em>
  }

  if (token.startsWith('`')) {
    return <code key={key}>{token.slice(1, -1)}</code>
  }

  const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token)

  if (link) {
    const href = sanitizeHref(link[2])

    if (href) {
      return (
        <a key={key} href={href} target="_blank" rel="noreferrer">
          {link[1]}
        </a>
      )
    }

    return link[1]
  }

  return token
}

function sanitizeHref(href: string): string | null {
  if (/^(https?:|mailto:)/.test(href)) {
    return href
  }

  return null
}
