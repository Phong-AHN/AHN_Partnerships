'use client';

import { useState } from 'react';
import { Copy, KeyRound, Pencil, UserPlus } from 'lucide-react';
import { formatDateTime, USER_ROLE_LABEL, USER_ROLES, type UserRole } from '@partners/core';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogTrigger,
  Field,
  FormActions,
  Input,
  Select,
  useToast,
} from '@partners/ui';
import { fieldError, readForm } from '@/components/read-form';
import { useAction } from '@/components/use-action';
import { inviteUserAction, resetLinkAction, updateUserAction } from '@/features/users/actions';

interface IssuedLink {
  link: string;
  expiresAt: string;
  name: string;
}

/** Shows a one-time set-password link once. It cannot be shown again. */
function LinkDialog({
  issued,
  onClose,
  kind,
}: {
  issued: IssuedLink | null;
  onClose: () => void;
  kind: 'invite' | 'reset';
}) {
  const toast = useToast();
  return (
    <Dialog
      open={issued !== null}
      onClose={onClose}
      title={
        kind === 'invite'
          ? `Send ${issued?.name ?? ''} their invite link`
          : `Reset link for ${issued?.name ?? ''}`
      }
      description="The app does not send email. Copy this link and send it yourself - it is shown only once."
      size="md"
      footer={
        <Button variant="primary" size="sm" onClick={onClose}>
          Done
        </Button>
      }
    >
      {issued && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              readOnly
              value={issued.link}
              onFocus={(event) => event.currentTarget.select()}
              aria-label="Set-password link"
              className="font-mono text-[12px]"
            />
            <Button
              variant="secondary"
              onClick={() => {
                void navigator.clipboard?.writeText(issued.link).then(
                  () => toast.success('Link copied.'),
                  () => toast.error('Copy failed - select the link and copy it by hand.'),
                );
              }}
            >
              <Copy className="size-4" />
              Copy
            </Button>
          </div>
          <p className="text-muted text-[12.5px]">
            Works once, until {formatDateTime(issued.expiresAt)}. Using it signs them in and sets
            their password.
          </p>
        </div>
      )}
    </Dialog>
  );
}

export function InviteUserButton() {
  const [issued, setIssued] = useState<IssuedLink | null>(null);
  return (
    <>
      <DialogTrigger
        title="Invite a team member"
        description="They get a link to set their own password."
        trigger={(open) => (
          <Button variant="primary" size="sm" onClick={open}>
            <UserPlus className="size-4" />
            Invite
          </Button>
        )}
      >
        {(close) => (
          <InviteForm
            onDone={(data) => {
              close();
              if (data) setIssued(data);
            }}
          />
        )}
      </DialogTrigger>
      <LinkDialog issued={issued} onClose={() => setIssued(null)} kind="invite" />
    </>
  );
}

function InviteForm({ onDone }: { onDone: (issued: IssuedLink | null) => void }) {
  const invite = useAction(inviteUserAction, { onSuccess: (data) => onDone(data) });
  const errors = invite.fieldErrors;
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void invite.run(readForm(event.currentTarget));
      }}
    >
      <Field label="Name" htmlFor="invite-name" required error={fieldError(errors, 'name')}>
        <Input id="invite-name" name="name" required autoFocus />
      </Field>
      <Field label="Email" htmlFor="invite-email" required error={fieldError(errors, 'email')}>
        <Input
          id="invite-email"
          name="email"
          type="email"
          required
          placeholder="name@ahnmedia.com"
        />
      </Field>
      <Field label="Role" htmlFor="invite-role" required error={fieldError(errors, 'role')}>
        <Select id="invite-role" name="role" defaultValue="MEMBER">
          {USER_ROLES.map((role) => (
            <option key={role} value={role}>
              {USER_ROLE_LABEL[role].label} - {USER_ROLE_LABEL[role].hint}
            </option>
          ))}
        </Select>
      </Field>
      <FormActions>
        <Button type="button" variant="ghost" size="sm" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" loading={invite.pending}>
          Create invite link
        </Button>
      </FormActions>
    </form>
  );
}

export function UserRowActions({
  user,
  isSelf,
}: {
  user: { id: string; name: string; role: UserRole; isActive: boolean };
  isSelf: boolean;
}) {
  const [issued, setIssued] = useState<IssuedLink | null>(null);
  const reset = useAction(resetLinkAction, {
    onSuccess: (data) => setIssued(data),
    toastOnSuccess: false,
  });

  return (
    <div className="flex justify-end gap-1">
      <DialogTrigger
        title={`Edit ${user.name}`}
        trigger={(open) => (
          <Button size="xs" variant="ghost" onClick={open}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
        )}
      >
        {(close) => <EditUserForm user={user} isSelf={isSelf} onDone={close} />}
      </DialogTrigger>
      {user.isActive && (
        <Button
          size="xs"
          variant="ghost"
          loading={reset.pending}
          onClick={() => void reset.run({ id: user.id })}
        >
          <KeyRound className="size-3.5" />
          Reset link
        </Button>
      )}
      <LinkDialog issued={issued} onClose={() => setIssued(null)} kind="reset" />
    </div>
  );
}

function EditUserForm({
  user,
  isSelf,
  onDone,
}: {
  user: { id: string; name: string; role: UserRole; isActive: boolean };
  isSelf: boolean;
  onDone: () => void;
}) {
  const update = useAction(updateUserAction, { onSuccess: onDone });
  const errors = update.fieldErrors;
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const values = readForm(event.currentTarget);
        // Your own role and status are not editable here (disabled fields are not submitted).
        void update.run(
          isSelf
            ? { ...values, id: user.id, role: user.role, isActive: true }
            : { ...values, id: user.id },
        );
      }}
    >
      {isSelf && (
        <Alert tone="info" dense>
          You can rename yourself here; another admin has to change your role or deactivate you.
        </Alert>
      )}
      {update.error && errors.role && (
        <Alert tone="danger" dense>
          {errors.role[0]}
        </Alert>
      )}
      <Field label="Name" htmlFor={`u-name-${user.id}`} required error={fieldError(errors, 'name')}>
        <Input id={`u-name-${user.id}`} name="name" required defaultValue={user.name} />
      </Field>
      <Field label="Role" htmlFor={`u-role-${user.id}`} required>
        <Select id={`u-role-${user.id}`} name="role" defaultValue={user.role} disabled={isSelf}>
          {USER_ROLES.map((role) => (
            <option key={role} value={role}>
              {USER_ROLE_LABEL[role].label} - {USER_ROLE_LABEL[role].hint}
            </option>
          ))}
        </Select>
      </Field>
      <Checkbox
        id={`u-active-${user.id}`}
        name="isActive"
        label="Active"
        hint="Deactivating signs them out everywhere and blocks sign-in. Their history stays."
        defaultChecked={user.isActive}
        disabled={isSelf}
      />
      <FormActions>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" loading={update.pending}>
          Save
        </Button>
      </FormActions>
    </form>
  );
}
