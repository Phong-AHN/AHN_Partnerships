'use client';

import { Mail, Pencil, UserPlus } from 'lucide-react';
import { USER_ROLE_LABEL, USER_ROLES, type UserRole } from '@partners/core';
import {
  Alert,
  Button,
  Checkbox,
  DialogTrigger,
  Field,
  FormActions,
  Input,
  Select,
} from '@partners/ui';
import { fieldError, readForm } from '@/components/read-form';
import { useAction } from '@/components/use-action';
import { inviteUserAction, sendSignInLinkAction, updateUserAction } from '@/features/users/actions';

export function InviteUserButton() {
  return (
    <DialogTrigger
      title="Invite a team member"
      description="They get an email with a link that signs them in. There are no passwords."
      trigger={(open) => (
        <Button variant="primary" size="sm" onClick={open}>
          <UserPlus className="size-4" />
          Invite
        </Button>
      )}
    >
      {(close) => <InviteForm onDone={close} />}
    </DialogTrigger>
  );
}

function InviteForm({ onDone }: { onDone: () => void }) {
  const invite = useAction(inviteUserAction, { onSuccess: onDone });
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
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" loading={invite.pending}>
          Send invitation
        </Button>
      </FormActions>
    </form>
  );
}

export function UserRowActions({
  user,
  isSelf,
}: {
  user: { id: string; name: string; role: UserRole; isActive: boolean; invited: boolean };
  isSelf: boolean;
}) {
  const send = useAction(sendSignInLinkAction);

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
      {user.isActive && !isSelf && (
        <Button
          size="xs"
          variant="ghost"
          loading={send.pending}
          onClick={() => void send.run({ id: user.id })}
          title="Emails them a link that signs them in"
        >
          <Mail className="size-3.5" />
          {user.invited ? 'Resend invitation' : 'Send sign-in link'}
        </Button>
      )}
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
