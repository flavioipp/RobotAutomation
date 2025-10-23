import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';

// Reusable confirmation dialog
// Props:
// - open: boolean
// - title: string
// - contentText: string
// - children: optional node to render inside content (e.g. details)
// - onCancel: () => void
// - onConfirm: () => void
// - confirmText: string (default 'Confirm')
// - cancelText: string (default 'Cancel')
// - confirmColor: 'error'|'primary' etc. (optional)
export default function ConfirmDialog({ open, title, contentText, children, onCancel, onConfirm, confirmText = 'Confirm', cancelText = 'Cancel', confirmColor = 'primary', disableBackdropClick = false }) {
  return (
    <Dialog open={Boolean(open)} onClose={onCancel} disableEscapeKeyDown={disableBackdropClick}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {contentText ? <DialogContentText>{contentText}</DialogContentText> : null}
        {children ? <Box sx={{ mt: 1 }}>{children}</Box> : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{cancelText}</Button>
        <Button color={confirmColor} onClick={onConfirm}>{confirmText}</Button>
      </DialogActions>
    </Dialog>
  );
}
