'use client'
import { useEffect, useRef } from 'react'
import styles from './Toast.module.css'

interface Props {
  message: string
  type?: 'success' | ''
  visible: boolean
  onHide: () => void
}

export default function Toast({ message, type = '', visible, onHide }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (visible) {
      clearTimeout(timer.current)
      timer.current = setTimeout(onHide, 3000)
    }
    return () => clearTimeout(timer.current)
  }, [visible, message, onHide])

  return (
    <div
      role="status"
      aria-live="polite"
      className={[styles.toast, visible ? styles.show : '', type === 'success' ? styles.success : ''].join(' ')}
    >
      {message}
    </div>
  )
}
