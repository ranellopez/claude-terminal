'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { ChatMessage, ChatSessionSummary } from '@/lib/types'
import { postBronelChat, listChats, createChat, getChat, updateChat, deleteChat } from '@/lib/api'
import styles from './BronelTab.module.css'

interface Props {
  onToast: (msg: string, type?: 'success' | '') => void
  active: boolean
}

const BOT = 'bronel'

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  } catch {
    return iso
  }
}

export default function BronelTab({ onToast, active }: Props) {
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const initializedRef = useRef(false)
  const msgListRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const refreshSessions = useCallback(async () => {
    try {
      const list = await listChats(BOT)
      setSessions(list)
      return list
    } catch {
      return []
    }
  }, [])

  const startFreshChat = useCallback(async () => {
    setLoading(true)
    try {
      const res = await postBronelChat([])
      const greeting: ChatMessage = { role: 'assistant', content: res.message }
      setMessages([greeting])
      try {
        const created = await createChat(BOT, `Chat — ${new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`, [greeting])
        setActiveId(created.id)
        refreshSessions()
      } catch {
        onToast('Could not save chat')
      }
    } catch {
      setMessages([{ role: 'assistant', content: 'Bronel is unavailable. Check your ANTHROPIC_API_KEY.' }])
    } finally {
      setLoading(false)
    }
  }, [onToast, refreshSessions])

  useEffect(() => {
    if (!active || initializedRef.current) return
    initializedRef.current = true
    ;(async () => {
      const list = await refreshSessions()
      if (list.length > 0) {
        try {
          const full = await getChat(list[0].id)
          setActiveId(full.id)
          setMessages(full.messages)
          return
        } catch {
          // fall through to a fresh chat
        }
      }
      startFreshChat()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  useEffect(() => {
    if (msgListRef.current) {
      msgListRef.current.scrollTop = msgListRef.current.scrollHeight
    }
  }, [messages, loading])

  async function send(text: string) {
    if (!text.trim() || loading) return
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setLoading(true)
    try {
      const res = await postBronelChat(next)
      const withReply = [...next, { role: 'assistant' as const, content: res.message }]
      setMessages(withReply)
      if (activeId !== null) {
        updateChat(activeId, { messages: withReply }).then(refreshSessions).catch(() => onToast('Could not save chat'))
      }
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  function handleSend() {
    const text = inputRef.current?.value ?? ''
    if (!text.trim()) return
    if (inputRef.current) inputRef.current.value = ''
    send(text)
  }

  function newChat() {
    setActiveId(null)
    setMessages([])
    startFreshChat()
  }

  async function loadSession(id: number) {
    if (id === activeId || loading) return
    setLoading(true)
    try {
      const full = await getChat(id)
      setActiveId(full.id)
      setMessages(full.messages)
    } catch {
      onToast('Could not load chat')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteChat(id)
      const remaining = await refreshSessions()
      if (id === activeId) {
        if (remaining.length > 0) {
          loadSession(remaining[0].id)
        } else {
          setActiveId(null)
          setMessages([])
          startFreshChat()
        }
      }
    } catch {
      onToast('Could not delete chat')
    }
  }

  async function handleRename(id: number, title: string) {
    setRenamingId(null)
    const trimmed = title.trim()
    if (!trimmed) return
    try {
      await updateChat(id, { title: trimmed })
      refreshSessions()
    } catch {
      onToast('Could not rename chat')
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.sidebar}>
        <button className={styles.newChatBtn} onClick={newChat}>+ New chat</button>
        <div className={styles.sessionList}>
          {sessions.map(s => (
            <div
              key={s.id}
              className={`${styles.sessionItem} ${s.id === activeId ? styles.sessionItemActive : ''}`}
              onClick={() => loadSession(s.id)}
            >
              {renamingId === s.id ? (
                <input
                  className={styles.sessionTitleInput}
                  defaultValue={s.title}
                  autoFocus
                  onClick={e => e.stopPropagation()}
                  onBlur={e => handleRename(s.id, e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                  }}
                />
              ) : (
                <div className={styles.sessionTitle} onClick={e => { e.stopPropagation(); setRenamingId(s.id) }}>
                  {s.title}
                </div>
              )}
              <div className={styles.sessionDate}>{formatDate(s.created_at)}</div>
              <button
                className={styles.sessionDelete}
                onClick={e => { e.stopPropagation(); handleDelete(s.id) }}
              >×</button>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.chatPanel}>
        <div className={styles.header}>
          <div className={styles.avatar}>🧠</div>
          <div style={{ flex: 1 }}>
            <div className={styles.name}>Bronel</div>
            <div className={styles.status}>● Ranel&apos;s AI assistant</div>
          </div>
        </div>

        <div className={styles.messages} ref={msgListRef}>
          {messages.map((m, i) =>
            m.role === 'assistant' ? (
              <div key={i} className={styles.botWrap}>
                <div className={styles.miniAvatar}>🧠</div>
                <div>
                  <div className={styles.sender}>Bronel</div>
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
              <div className={styles.miniAvatar}>🧠</div>
              <div>
                <div className={styles.sender}>Bronel</div>
                <div className={`${styles.bubbleBot} ${styles.typing}`}>Bronel is thinking…</div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.inputRow}>
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Message Bronel…"
            disabled={loading}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <button
            className={styles.sendBtn}
            disabled={loading}
            onClick={handleSend}
          >↑</button>
        </div>
      </div>
    </div>
  )
}
