'use client'
import { useState, useEffect, useRef } from 'react'
import type { ChatMessage, Profile } from '@/lib/types'
import { postChat, postChatGenerate } from '@/lib/api'
import styles from './GymBotTab.module.css'

interface Props {
  profile: Profile | null
  onGenerated: () => void
  onToast: (msg: string, type?: 'success' | '') => void
  active: boolean
}

export default function GymBotTab({ profile, onGenerated, onToast, active }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const msgListRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (active && !initialized && !loading) {
      setInitialized(true)
      initChat()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Intentional: initialized/loading guard prevents re-entry; profile is stable for the lifetime of a chat session
  }, [active])

  useEffect(() => {
    if (msgListRef.current) {
      msgListRef.current.scrollTop = msgListRef.current.scrollHeight
    }
  }, [messages, loading])

  async function initChat() {
    setLoading(true)
    try {
      const res = await postChat([], profile ?? {})
      setMessages([{ role: 'assistant', content: res.message }])
    } catch {
      setMessages([{ role: 'assistant', content: 'GymBot is unavailable. Check your ANTHROPIC_API_KEY.' }])
    } finally {
      setLoading(false)
    }
  }

  async function send(text: string) {
    if (!text.trim() || loading || ready) return
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setLoading(true)
    try {
      const res = await postChat(next, profile ?? {})
      setMessages([...next, { role: 'assistant', content: res.message }])
      if (res.ready) setReady(true)
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  async function generate() {
    setLoading(true)
    try {
      const res = await postChatGenerate(messages, profile ?? {})
      if (res.ok) {
        onToast('Plan generated!', 'success')
        setMessages([])
        setReady(false)
        setInitialized(false)
        onGenerated()
      } else {
        onToast('Generation failed')
      }
    } catch {
      onToast('Generation failed')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setMessages([])
    setReady(false)
    setLoading(false)
    setInitialized(false)
    // Re-trigger greeting immediately if the tab is already visible
    if (active) {
      setInitialized(true)
      initChat()
    }
  }

  function handleSend() {
    const text = inputRef.current?.value ?? ''
    if (!text.trim()) return
    if (inputRef.current) inputRef.current.value = ''
    send(text)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.avatar}>🤖</div>
        <div style={{ flex: 1 }}>
          <div className={styles.name}>GymBot</div>
          <div className={styles.status}>● Ready to build your plan</div>
        </div>
        <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={reset}>New chat</button>
      </div>

      <div className={styles.messages} ref={msgListRef}>
        {messages.map((m, i) =>
          m.role === 'assistant' ? (
            <div key={i} className={styles.botWrap}>
              <div className={styles.miniAvatar}>🤖</div>
              <div>
                <div className={styles.sender}>GymBot</div>
                <div className={styles.bubbleBot}>{m.content}</div>
              </div>
            </div>
          ) : (
            <div key={i} className={styles.userWrap}>
              <div>
                <div className={`${styles.sender} ${styles.senderRight}`}>You</div>
                <div className={styles.bubbleUser}>{m.content}</div>
              </div>
            </div>
          )
        )}

        {loading && (
          <div className={styles.botWrap}>
            <div className={styles.miniAvatar}>🤖</div>
            <div>
              <div className={styles.sender}>GymBot</div>
              <div className={`${styles.bubbleBot} ${styles.typing}`}>GymBot is thinking…</div>
            </div>
          </div>
        )}

        {ready && !loading && (
          <button className={styles.generateBtn} onClick={generate}>Generate my plan ✨</button>
        )}
      </div>

      <div className={styles.inputRow}>
        <input
          ref={inputRef}
          className={styles.input}
          placeholder="Message GymBot…"
          disabled={loading || ready}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
        />
        <button
          className={styles.sendBtn}
          disabled={loading || ready}
          onClick={handleSend}
        >↑</button>
      </div>
    </div>
  )
}
