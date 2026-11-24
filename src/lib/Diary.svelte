<script lang="ts">
  import { onDestroy, untrack } from 'svelte'
  import { entries, saveEntry, hooks, tagsOf } from './vault.svelte'
  import * as d from './dates'

  let { date = $bindable() }: { date: string } = $props()

  const MOODS = ['😊', '😌', '😐', '😢', '😠', '🥰', '🤒', '✨']

  let text = $state('')
  let mood = $state('')
  let status = $state('')
  let loadedFor = ''
  let dirty = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let ta: HTMLTextAreaElement | undefined = $state()
  let datePicker: HTMLInputElement | undefined = $state()

  async function flush() {
    clearTimeout(timer)
    if (!dirty || !loadedFor) return
    dirty = false
    const [k, t, m] = [loadedFor, text, mood]
    try {
      await saveEntry(k, t, m)
      if (k === loadedFor) status = t.trim() || m ? '저장됨' : ''
    } catch {
      dirty = true
      status = '저장 실패'
    }
  }
  hooks.flush = flush
  onDestroy(() => {
    flush()
    if (hooks.flush === flush) hooks.flush = null
  })

  // load the entry when the date changes (saving the previous one first)
  $effect(() => {
    const k = date
    untrack(() => {
      if (dirty) flush()
      const e = entries.get(k)
      text = e?.text ?? ''
      mood = e?.mood ?? ''
      loadedFor = k
      status = ''
      requestAnimationFrame(autosize)
    })
  })

  function changed() {
    dirty = true
    status = '저장 중…'
    clearTimeout(timer)
    timer = setTimeout(flush, 700)
    autosize()
  }

  function autosize() {
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.max(ta.scrollHeight, 160) + 'px'
  }

  function pickMood(m: string) {
    mood = mood === m ? '' : m
    changed()
  }

  const viewYear = $derived(d.yearOf(date))
  const mds = $derived(d.sameDayKeys(date))

  // every entry on this month-day in any other year, newest first
  const others = $derived(
    [...entries.values()]
      .filter((e) => e.date !== date && mds.includes(d.monthDay(e.date)))
      .sort((a, b) => b.date.localeCompare(a.date)),
  )

  // year strip: from the earliest year with any entry (or 9 years back) to this year
  const years = $derived.by(() => {
    const cur = new Date().getFullYear()
    let min = Math.min(viewYear, cur) - 4
    for (const k of entries.keys()) min = Math.min(min, d.yearOf(k))
    const max = Math.max(viewYear, cur)
    const filled = new Set([...entries.keys()].filter((k) => mds.includes(d.monthDay(k))).map(d.yearOf))
    const out: { y: number; has: boolean }[] = []
    for (let y = max; y >= min; y--) out.push({ y, has: filled.has(y) })
    return out
  })

  const isToday = $derived(date === d.todayKey())
  const lunarLabel = $derived(d.lunar(date))
  let expanded = $state<Record<string, boolean>>({})

  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return
    if (e.key === 'ArrowLeft') date = d.addDays(date, -1)
    else if (e.key === 'ArrowRight') date = d.addDays(date, 1)
    else if (e.key === 'ArrowUp') date = d.addYears(date, 1)
    else if (e.key === 'ArrowDown') date = d.addYears(date, -1)
  }

  function openPicker() {
    if (!datePicker) return
    if ('showPicker' in datePicker) {
      try {
        datePicker.showPicker()
        return
      } catch { /* fall through */ }
    }
    datePicker.focus()
  }
</script>

<svelte:window onkeydown={onKey} onvisibilitychange={() => document.hidden && flush()} />

<section class="datebar">
  <button class="ghost nav" aria-label="전날" onclick={() => (date = d.addDays(date, -1))}>‹</button>
  <button class="ghost title" onclick={openPicker} title="날짜 고르기">
    <span class="md">{d.formatShort(date)}</span>
    <span class="sub">{viewYear}년 · {d.weekday(date)}요일{lunarLabel ? ` · ${lunarLabel}` : ''}</span>
  </button>
  <button class="ghost nav" aria-label="다음날" onclick={() => (date = d.addDays(date, 1))}>›</button>
  <input class="hidden-date" type="date" bind:this={datePicker} value={date}
    onchange={(e) => e.currentTarget.value && (date = e.currentTarget.value)} tabindex="-1" aria-hidden="true" />
</section>
{#if !isToday}
  <div class="center"><button class="small today" onclick={() => (date = d.todayKey())}>오늘로</button></div>
{/if}

<nav class="years" aria-label="같은 날의 연도">
  {#each years as { y, has } (y)}
    <button class={['yr', y === viewYear && 'on', has && 'has']} onclick={() => (date = d.addYears(date, y - viewYear))}>
      {y}
    </button>
  {/each}
</nav>

<article class="card editor">
  <header>
    <strong>{viewYear}년의 이 날</strong>
    <span class="small muted">{status}</span>
  </header>
  <div class="moods" role="group" aria-label="기분">
    {#each MOODS as m}
      <button class={['mood', mood === m && 'on']} onclick={() => pickMood(m)} aria-pressed={mood === m}>{m}</button>
    {/each}
  </div>
  <textarea bind:this={ta} bind:value={text} oninput={changed} onblur={flush}
    placeholder={isToday ? '오늘은 어떤 하루였나요?' : '이 날의 기록을 남겨보세요. #태그 를 쓸 수 있어요.'}></textarea>
</article>

<section class="past">
  <h2>같은 날, 다른 해 <span class="muted small">{others.length ? `${others.length}개의 기록` : ''}</span></h2>
  {#if others.length === 0}
    <p class="muted empty">아직 {d.formatShort(date)}의 다른 해 기록이 없어요.<br />위의 연도를 눌러 옛 일기를 옮겨 적을 수도 있어요.</p>
  {/if}
  {#each others as e (e.date)}
    {@const long = e.text.length > 220 || e.text.split('\n').length > 6}
    <article class="card past-item">
      <header>
        <button class="ghost jump" onclick={() => (date = e.date)}>
          <b>{d.yearOf(e.date)}</b>
          <span class="muted small">{d.yearsAgoLabel(viewYear, d.yearOf(e.date))} · {d.weekday(e.date)}요일{d.monthDay(e.date) !== d.monthDay(date) ? ` · ${d.formatShort(e.date)}` : ''}</span>
        </button>
        {#if e.mood}<span class="pmood">{e.mood}</span>{/if}
      </header>
      <p class={['body', long && !expanded[e.date] && 'clamp']}>{e.text}</p>
      {#if long}
        <button class="ghost small more" onclick={() => (expanded[e.date] = !expanded[e.date])}>{expanded[e.date] ? '접기' : '더 보기'}</button>
      {/if}
      {#if tagsOf(e.text).length}
        <div class="tags">{#each tagsOf(e.text) as t}<span>#{t}</span>{/each}</div>
      {/if}
    </article>
  {/each}
</section>

<style>
  .datebar { display: grid; grid-template-columns: auto 1fr auto; align-items: center; position: relative; }
  .nav { font-size: 1.8rem; line-height: 1; padding: 0.3rem 0.9rem; color: var(--muted); }
  .title { display: grid; justify-items: center; padding: 0.2rem; }
  .md { font-size: 1.9rem; font-weight: 700; letter-spacing: -0.03em; }
  .sub { font-size: 0.9rem; color: var(--muted); }
  .hidden-date { position: absolute; left: 50%; bottom: 0; width: 1px; height: 1px; opacity: 0; pointer-events: none; padding: 0; border: 0; }
  .center { text-align: center; }
  .today { padding: 0.2rem 0.8rem; border-radius: 999px; }
  .years { display: flex; gap: 0.35rem; overflow-x: auto; padding: 0.8rem 0.1rem; scrollbar-width: thin; }
  .yr { flex: none; padding: 0.25rem 0.6rem; border-radius: 999px; font-size: 0.85rem; color: var(--muted); position: relative; }
  .yr.has { color: var(--ink); border-color: var(--gold); }
  .yr.has::after { content: ''; position: absolute; top: 3px; right: 5px; width: 5px; height: 5px; border-radius: 50%; background: var(--gold); }
  .yr.on { background: var(--accent); border-color: var(--accent); color: var(--paper); }
  .editor { padding: 1rem; }
  .editor header, .past-item header { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
  .moods { display: flex; gap: 0.25rem; flex-wrap: wrap; margin: 0.5rem 0; }
  .mood { padding: 0.15rem 0.4rem; font-size: 1.2rem; border-color: transparent; background: transparent; filter: grayscale(0.7); opacity: 0.7; }
  .mood.on { filter: none; opacity: 1; background: var(--accent-soft); border-color: var(--gold); }
  textarea { resize: none; min-height: 160px; border: none; padding: 0.3rem 0; background: transparent; line-height: 1.75; overflow: hidden; }
  .past h2 { font-size: 1.05rem; margin: 1.6rem 0 0.6rem; display: flex; gap: 0.5rem; align-items: baseline; }
  .empty { text-align: center; padding: 1.5rem 0; font-size: 0.95rem; }
  .past-item { padding: 0.9rem 1rem; margin-bottom: 0.7rem; border-left: 4px solid var(--gold); }
  .jump { padding: 0; display: flex; gap: 0.5rem; align-items: baseline; text-align: left; }
  .jump b { font-size: 1.1rem; }
  .pmood { font-size: 1.2rem; }
  .body { white-space: pre-wrap; word-break: break-word; margin: 0.4rem 0 0; }
  .clamp { display: -webkit-box; -webkit-line-clamp: 5; line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden; }
  .more { padding: 0.2rem 0; color: var(--accent); }
  .tags { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.4rem; }
  .tags span { font-size: 0.8rem; color: var(--accent); background: var(--accent-soft); padding: 0.05rem 0.5rem; border-radius: 999px; }
</style>
