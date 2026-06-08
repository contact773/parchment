import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Field'

export function CommentDialog({
  open,
  onClose,
  onSubmit,
  kind = 'comment',
}: {
  open: boolean
  onClose: () => void
  onSubmit: (text: string) => void
  kind?: 'comment' | 'note'
}) {
  const [text, setText] = useState('')
  useEffect(() => {
    if (open) setText('')
  }, [open])
  const isNote = kind === 'note'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isNote ? 'Add private note' : 'Add comment'}
      description={isNote ? 'Attach a private note to the selected text.' : 'Annotate the selected text with a comment.'}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => onSubmit(text.trim())} disabled={!text.trim()}>
            {isNote ? 'Add note' : 'Add comment'}
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
