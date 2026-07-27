import { describe, expect, it } from 'vitest'
import { buildFieldBackupCommentMarkdown } from './buildFieldBackupComment'
import { markdownToAdf } from '../utils/adf'

describe('buildFieldBackupCommentMarkdown', () => {
  it('preserves description images as ADF media when posting the backup comment', () => {
    const markdown = buildFieldBackupCommentMarkdown(
      {
        description:
          'Texto original\n\n![Image](/api/jira/issues/CDPM-12/media/76481dc1-acca-4e90-be7b-096124d1e54d?layout=center&width=640&height=360)\n',
      },
      new Date('2026-07-27T11:00:00'),
    )

    expect(markdown).toContain('## Description')
    expect(markdown).toContain(
      '![Image](/api/jira/issues/CDPM-12/media/76481dc1-acca-4e90-be7b-096124d1e54d?layout=center&width=640&height=360)',
    )

    const adf = markdownToAdf(markdown!)
    const media = adf.content.find((node) => node.type === 'mediaSingle')
    expect(media).toEqual({
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
    })
  })

  it('accepts absolute BFF media URLs in backup bodies', () => {
    const adf = markdownToAdf(
      '![Image](http://localhost:3000/api/jira/issues/CDPM-12/media/76481dc1-acca-4e90-be7b-096124d1e54d?width=100)',
    )
    expect(adf.content[0]).toMatchObject({
      type: 'mediaSingle',
      content: [
        {
          type: 'media',
          attrs: {
            type: 'file',
            id: '76481dc1-acca-4e90-be7b-096124d1e54d',
            width: 100,
          },
        },
      ],
    })
  })
})
