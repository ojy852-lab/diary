import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

const app = mount(App, { target: document.getElementById('app')! })

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch(() => {})
}
// ask the browser not to evict our storage (matters most on iOS / Safari)
navigator.storage?.persist?.().catch(() => {})

export default app
