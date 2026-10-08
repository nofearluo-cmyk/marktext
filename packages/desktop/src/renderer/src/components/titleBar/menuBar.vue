<template>
  <nav
    class="application-menu-bar"
    role="menubar"
    @keydown="handleKeydown"
  >
    <button
      v-for="(key, index) in menuKeys"
      :key="key"
      type="button"
      role="menuitem"
      aria-haspopup="menu"
      :tabindex="index === focusedIndex ? 0 : -1"
      @focus="focusedIndex = index"
      @mousedown.prevent
      @click="openMenu($event, index)"
      @keydown.down.prevent="openMenu($event, index)"
    >
      {{ t(key).replace(/\(&[^)]+\)/g, '').replace(/&(.)/g, '$1') }}
    </button>
  </nav>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { applicationMenuKeys } from '@shared/applicationMenu'

const { t } = useI18n()
const menuKeys = applicationMenuKeys
const focusedIndex = ref(0)

const openMenu = (event: Event, index: number) => {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  // Native popup coordinates are content-relative DIP, including page zoom.
  const zoom = window.electron.webFrame.getZoomFactor()
  window.electron.windowControl.popupApplicationMenu({
    x: Math.round(rect.left * zoom),
    y: Math.round(rect.bottom * zoom)
  }, index)
}

const handleKeydown = (event: KeyboardEvent) => {
  const buttons = (event.currentTarget as HTMLElement).querySelectorAll('button')
  let next = focusedIndex.value
  if (event.key === 'ArrowRight') next = (next + 1) % buttons.length
  else if (event.key === 'ArrowLeft') next = (next + buttons.length - 1) % buttons.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = buttons.length - 1
  else return
  event.preventDefault()
  buttons[next]?.focus()
}
</script>

<style scoped>
.application-menu-bar {
  display: flex;
  align-items: stretch;
  height: 100%;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-app-region: no-drag;
}
button {
  flex: 0 0 auto;
  border: 0;
  border-radius: 3px;
  padding: 0 9px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 13px;
  white-space: nowrap;
  cursor: default;
}
button:hover,
button:focus-visible {
  background: var(--sideBarBgColor);
  color: var(--sideBarTitleColor);
}
button:focus-visible {
  outline: 1px solid var(--themeColor);
  outline-offset: -2px;
}
</style>
