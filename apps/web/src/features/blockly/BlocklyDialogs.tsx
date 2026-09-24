import { useEffect, useRef, useState } from 'react';
import * as Blockly from 'blockly/core';

import { Button, Field, Modal } from '@/components/ui';

type Dialog =
  | { kind: 'prompt'; message: string; value: string; done: (v: string | null) => void }
  | { kind: 'confirm'; message: string; done: (ok: boolean) => void }
  | { kind: 'alert'; message: string; done: () => void };

/**
 * Thay ba hộp thoại mặc định của Blockly (tạo biến, đổi tên, xác nhận xoá…)
 * bằng hộp thoại theo thiết kế của INO. Hộp mặc định là HTML thô, dính góc
 * trên bên trái và trông rất lạc lõng, nhất là khi đang toàn màn hình.
 */
export function BlocklyDialogs() {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    Blockly.dialog.setPrompt((message, defaultValue, callback) => {
      setText(defaultValue ?? '');
      setDialog({ kind: 'prompt', message, value: defaultValue ?? '', done: callback });
    });

    Blockly.dialog.setConfirm((message, callback) => {
      setDialog({ kind: 'confirm', message, done: callback });
    });

    Blockly.dialog.setAlert((message, callback) => {
      setDialog({ kind: 'alert', message, done: () => callback?.() });
    });
  }, []);

  useEffect(() => {
    if (dialog?.kind === 'prompt') inputRef.current?.focus();
  }, [dialog]);

  if (!dialog) return null;

  const close = () => setDialog(null);

  const accept = () => {
    if (dialog.kind === 'prompt') dialog.done(text.trim() || null);
    else if (dialog.kind === 'confirm') dialog.done(true);
    else dialog.done();
    close();
  };

  const cancel = () => {
    if (dialog.kind === 'prompt') dialog.done(null);
    else if (dialog.kind === 'confirm') dialog.done(false);
    else dialog.done();
    close();
  };

  const icon = dialog.kind === 'confirm' ? 'help' : dialog.kind === 'alert' ? 'info' : 'edit_note';

  return (
    <Modal
      icon={icon}
      title={dialog.message}
      onClose={cancel}
      onSubmit={dialog.kind === 'alert' ? undefined : accept}
      footer={
        <>
          {dialog.kind !== 'alert' && (
            <Button variant="ghost" size="sm" onClick={cancel}>
              Huỷ
            </Button>
          )}
          <Button size="sm" onClick={accept} disabled={dialog.kind === 'prompt' && !text.trim()}>
            {dialog.kind === 'prompt' ? 'Tạo' : dialog.kind === 'confirm' ? 'Đồng ý' : 'Đã hiểu'}
          </Button>
        </>
      }
    >
      {dialog.kind === 'prompt' && (
        <Field
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ví dụ: tocDo"
          maxLength={40}
          autoFocus
        />
      )}
    </Modal>
  );
}
