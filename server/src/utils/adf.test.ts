import { describe, expect, it } from 'vitest'
import { adfToMarkdown, markdownToAdf } from './adf'

describe('adf media round-trip', () => {
  it('converts mediaSingle file nodes to proxy image markdown', () => {
    const md = adfToMarkdown(
      {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Before' }],
          },
          {
            type: 'mediaSingle',
            attrs: { layout: 'center' },
            content: [
              {
                type: 'media',
                attrs: {
                  type: 'file',
                  id: '76481dc1-acca-4e90-be7b-096124d1e54d',
                  collection: '',
                  width: 640,
                  height: 360,
                },
              },
            ],
          },
        ],
      },
      { issueKey: 'CDPM-12' },
    )

    expect(md).toContain('Before')
    expect(md).toContain(
      '![Image](/api/jira/issues/CDPM-12/media/76481dc1-acca-4e90-be7b-096124d1e54d?layout=center&width=640&height=360)',
    )
  })

  it('converts external media to markdown image URLs', () => {
    const md = adfToMarkdown({
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'mediaSingle',
          attrs: { layout: 'center' },
          content: [
            {
              type: 'media',
              attrs: {
                type: 'external',
                url: 'https://example.com/shot.png',
                alt: 'Shot',
              },
            },
          ],
        },
      ],
    })

    expect(md).toBe('![Shot](https://example.com/shot.png)')
  })

  it('round-trips proxy media markdown back to ADF mediaSingle', () => {
    const markdown =
      'Intro\n\n![Image](/api/jira/issues/CDPM-12/media/76481dc1-acca-4e90-be7b-096124d1e54d?layout=center&width=640&height=360)\n\nOutro'
    const adf = markdownToAdf(markdown)

    expect(adf.content).toEqual([
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Intro' }],
      },
      {
        type: 'mediaSingle',
        attrs: { layout: 'center' },
        content: [
          {
            type: 'media',
            attrs: {
              type: 'file',
              id: '76481dc1-acca-4e90-be7b-096124d1e54d',
              collection: '',
              width: 640,
              height: 360,
            },
          },
        ],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Outro' }],
      },
    ])
  })

  it('omits file media when issueKey is missing', () => {
    const md = adfToMarkdown({
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'mediaSingle',
          content: [
            {
              type: 'media',
              attrs: {
                type: 'file',
                id: '76481dc1-acca-4e90-be7b-096124d1e54d',
                collection: '',
              },
            },
          ],
        },
      ],
    })

    expect(md).toBe('')
  })
})
