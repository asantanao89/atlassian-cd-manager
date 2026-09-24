import { describe, expect, it } from 'vitest'
import { isReadyForTest, sprintActionRequired } from './readyForTest'

describe('isReadyForTest', () => {
  it('is ready when work is done and a code review is still to do', () => {
    expect(
      isReadyForTest('En desarrollo', [
        { summary: 'sub 1', statusName: 'Hecho' },
        { summary: 'sub 2', statusName: 'Hecho' },
        { summary: 'Code review', statusName: 'En proceso' },
        { summary: 'Code review', statusName: 'Por hacer' },
      ]),
    ).toBe(true)
  })

  it('is not ready when a work subtask is still to do', () => {
    expect(
      isReadyForTest('En desarrollo', [
        { summary: 'sub 1', statusName: 'Por hacer' },
        { summary: 'code review', statusName: 'Por hacer' },
      ]),
    ).toBe(false)
  })

  it('is not ready when a work subtask is in progress', () => {
    expect(
      isReadyForTest('En desarrollo', [
        { summary: 'sub 1', statusName: 'En proceso' },
        { summary: 'sub 2', statusName: 'Hecho' },
        { summary: 'Pruebas cruzadas / Code review', statusName: 'Por hacer' },
      ]),
    ).toBe(false)
  })

  it('is not ready when the review subtask is in progress and none is to do', () => {
    expect(
      isReadyForTest('En desarrollo', [
        { summary: 'sub 1', statusName: 'Hecho' },
        { summary: 'sub 2', statusName: 'Hecho' },
        { summary: 'Pruebas cruzadas / Code review', statusName: 'En proceso' },
      ]),
    ).toBe(false)
  })

  it('is ready when work is done and pruebas cruzadas or code review is to do', () => {
    expect(
      isReadyForTest('En desarrollo', [
        { summary: 'sub 1', statusName: 'Hecho' },
        { summary: 'sub 2', statusName: 'Hecho' },
        { summary: 'Pruebas cruzadas / Code review', statusName: 'Por hacer' },
      ]),
    ).toBe(true)
  })

  it('marks Finalizado desarrollo as Prepare PO', () => {
    expect(sprintActionRequired('Finalizado desarrollo', [])).toBe('Prepare PO')
  })

  it('ignores stories that are not in development', () => {
    expect(
      isReadyForTest('Backlog', [
        { summary: 'sub 1', statusName: 'Hecho' },
        { summary: 'Code review', statusName: 'Por hacer' },
      ]),
    ).toBe(false)
  })
})
