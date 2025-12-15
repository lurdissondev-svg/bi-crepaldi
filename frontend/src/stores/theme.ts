import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

type Theme = 'dark' | 'light'

const STORAGE_KEY = 'bi-crepaldi-theme'

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark'

  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored

  // Check system preference
  if (window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light'
  }

  return 'dark'
}

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>('dark')

  function initTheme() {
    theme.value = getInitialTheme()
    applyTheme(theme.value)
  }

  function applyTheme(newTheme: Theme) {
    const root = document.documentElement

    if (newTheme === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
    } else {
      root.classList.add('light')
      root.classList.remove('dark')
    }

    localStorage.setItem(STORAGE_KEY, newTheme)
  }

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  function setTheme(newTheme: Theme) {
    theme.value = newTheme
  }

  // Watch for theme changes and apply
  watch(theme, (newTheme) => {
    applyTheme(newTheme)
  })

  return {
    theme,
    initTheme,
    toggleTheme,
    setTheme,
  }
})
