import { describe, it, expect } from 'vitest'
import { buildAdfComment, extractPlainTextFromAdf } from '../utils/adf'

describe('buildAdfComment', () => {
  it('builds a valid ADF doc from normal text', () => {
    const doc = buildAdfComment('Hello world')
    expect(doc.type).toBe('doc')
    expect(doc.version).toBe(1)
    expect(doc.content).toHaveLength(1)
    expect(doc.content[0].type).toBe('paragraph')
    expect(doc.content[0].content[0]).toEqual({ type: 'text', text: 'Hello world' })
  })

  it('builds a valid ADF doc from empty text (empty paragraph)', () => {
    const doc = buildAdfComment('')
    expect(doc.type).toBe('doc')
    expect(doc.content[0].content).toHaveLength(0)
  })

  it('trims whitespace from text', () => {
    const doc = buildAdfComment('  hello  ')
    expect(doc.content[0].content[0]).toEqual({ type: 'text', text: 'hello' })
  })
})

describe('extractPlainTextFromAdf', () => {
  it('extracts text from a simple ADF doc', () => {
    const doc = {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello world' }],
        },
      ],
    }
    expect(extractPlainTextFromAdf(doc)).toBe('Hello world')
  })

  it('extracts text from multiple paragraphs', () => {
    const doc = {
      type: 'doc',
      version: 1,
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Line 1' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Line 2' }] },
      ],
    }
    expect(extractPlainTextFromAdf(doc)).toBe('Line 1Line 2')
  })

  it('returns empty string for null input', () => {
    expect(extractPlainTextFromAdf(null)).toBe('')
  })

  it('returns empty string for undefined input', () => {
    expect(extractPlainTextFromAdf(undefined)).toBe('')
  })

  it('returns empty string for non-doc objects', () => {
    expect(extractPlainTextFromAdf({ type: 'paragraph' })).toBe('')
  })

  it('does not throw on unexpected/malformed ADF', () => {
    expect(() => extractPlainTextFromAdf({ type: 'doc', content: null })).not.toThrow()
    expect(extractPlainTextFromAdf({ type: 'doc', content: null })).toBe('')
  })

  it('handles ADF with no text nodes', () => {
    const doc = {
      type: 'doc',
      version: 1,
      content: [{ type: 'paragraph', content: [] }],
    }
    expect(extractPlainTextFromAdf(doc)).toBe('')
  })

  it('is a round-trip with buildAdfComment', () => {
    const text = 'Trabajo realizado en la tarea'
    expect(extractPlainTextFromAdf(buildAdfComment(text))).toBe(text)
  })
})
