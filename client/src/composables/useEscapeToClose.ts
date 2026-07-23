import { onMounted, onBeforeUnmount, toValue, type MaybeRefOrGetter } from 'vue'

/**
 * Calls `onClose` when Escape is pressed, while the dialog is active.
 * If `isActive` is omitted, Escape always closes while the component is mounted
 * (use with `v-if` portals).
 */
export function useEscapeToClose(
  onClose: () => void,
  isActive?: MaybeRefOrGetter<boolean>,
): void {
  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return
    if (isActive !== undefined && !toValue(isActive)) return
    event.preventDefault()
    onClose()
  }

  onMounted(() => {
    document.addEventListener('keydown', onKeydown)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('keydown', onKeydown)
  })
}
