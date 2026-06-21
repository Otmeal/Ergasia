import { useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { buildTitleSuggestions } from '../features/work-blocks/titleSuggestions'
import type { Tag, WorkBlock } from '../types'

type TitleSuggestInputProps = {
  value: string
  onChange: (value: string) => void
  onPick?: (title: string, tagIds: string[]) => void
  workBlocks: WorkBlock[]
  tags: Tag[]
  selectedTagIds: string[]
  wrapperClassName?: string
  inputClassName?: string
  placeholder?: string
  ariaLabel?: string
  required?: boolean
}

export function TitleSuggestInput({
  value,
  onChange,
  onPick,
  workBlocks,
  tags,
  selectedTagIds,
  wrapperClassName,
  inputClassName,
  placeholder,
  ariaLabel,
  required,
}: TitleSuggestInputProps) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)

  const tagsById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags])

  const suggestions = useMemo(
    () => buildTitleSuggestions(workBlocks, value, selectedTagIds),
    [workBlocks, value, selectedTagIds],
  )

  const showList = open && suggestions.length > 0

  function pick(index: number) {
    const suggestion = suggestions[index]

    if (!suggestion) {
      return
    }

    onChange(suggestion.title)
    onPick?.(suggestion.title, suggestion.tagIds)
    setOpen(false)
    setHighlight(-1)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!showList) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlight((current) => (current + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlight((current) => (current <= 0 ? suggestions.length - 1 : current - 1))
    } else if (event.key === 'Enter' && highlight >= 0) {
      event.preventDefault()
      pick(highlight)
    } else if (event.key === 'Escape') {
      setOpen(false)
      setHighlight(-1)
    }
  }

  return (
    <div className={wrapperClassName ? `title-suggest ${wrapperClassName}` : 'title-suggest'}>
      <input
        className={inputClassName}
        type="text"
        required={required}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
          setHighlight(-1)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
      />
      {showList ? (
        <ul className="title-suggest-list" role="listbox">
          {suggestions.map((suggestion, index) => {
            const suggestionTags = suggestion.tagIds
              .map((id) => tagsById.get(id))
              .filter((tag): tag is Tag => Boolean(tag))

            return (
              <li key={suggestion.title} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={index === highlight}
                  className={index === highlight ? 'title-suggest-item active' : 'title-suggest-item'}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => pick(index)}
                >
                  <span className="title-suggest-text">{suggestion.title}</span>
                  {suggestionTags.length > 0 ? (
                    <span className="title-suggest-tags">
                      {suggestionTags.map((tag) => (
                        <span
                          key={tag.id}
                          className="color-dot"
                          style={{ backgroundColor: tag.color }}
                          title={tag.name}
                        />
                      ))}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
