import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Field'

export function CommentDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (text: string) => void
}) {
  const [text, setText] = useState('')
  useEffect(() => {
    if (open) setText('')
  }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add comment"
      description="Annotate the selected text with a private note."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onSubmit(text.trim())} disabled={!text.trim()}>
            Add comment
          </Button>
        </>
      }
    >
      <Textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Your note…"
        className="min-h-[120px]"
      />
    </Modal>
  )
}
