'use client';

import { useState } from 'react';
import { Linkedin, Mail, Pencil, Phone, Plus, Star, Trash2, Users } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  Dialog,
  Empty,
  Field,
  FormActions,
  IconButton,
  Input,
  Textarea,
} from '@partners/ui';
import { fieldError, readForm } from '@/components/read-form';
import { useAction } from '@/components/use-action';
import { deleteContactAction, upsertContactAction } from '@/features/partners/actions';

export interface ContactRow {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  isPrimary: boolean;
  notes: string | null;
}

function ContactForm({
  partnerId,
  contact,
  onDone,
}: {
  partnerId: string;
  contact: ContactRow | null;
  onDone: () => void;
}) {
  const save = useAction(upsertContactAction, { onSuccess: onDone });
  const errors = save.fieldErrors;
  const key = contact?.id ?? 'new';

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void save.run({ ...readForm(event.currentTarget), partnerId, id: contact?.id });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor={`c-name-${key}`} required error={fieldError(errors, 'name')}>
          <Input id={`c-name-${key}`} name="name" required autoFocus defaultValue={contact?.name} />
        </Field>
        <Field label="Title" htmlFor={`c-title-${key}`} error={fieldError(errors, 'title')}>
          <Input id={`c-title-${key}`} name="title" defaultValue={contact?.title ?? ''} />
        </Field>
        <Field label="Email" htmlFor={`c-email-${key}`} error={fieldError(errors, 'email')}>
          <Input
            id={`c-email-${key}`}
            name="email"
            type="email"
            defaultValue={contact?.email ?? ''}
          />
        </Field>
        <Field label="Phone" htmlFor={`c-phone-${key}`} error={fieldError(errors, 'phone')}>
          <Input id={`c-phone-${key}`} name="phone" defaultValue={contact?.phone ?? ''} />
        </Field>
      </div>
      <Field label="LinkedIn" htmlFor={`c-li-${key}`} error={fieldError(errors, 'linkedin')}>
        <Input
          id={`c-li-${key}`}
          name="linkedin"
          placeholder="linkedin.com/in/..."
          defaultValue={contact?.linkedin ?? ''}
        />
      </Field>
      <Field label="Notes" htmlFor={`c-notes-${key}`} error={fieldError(errors, 'notes')}>
        <Textarea id={`c-notes-${key}`} name="notes" rows={2} defaultValue={contact?.notes ?? ''} />
      </Field>
      <Checkbox
        id={`c-primary-${key}`}
        name="isPrimary"
        label="Primary contact"
        hint="The person we go to first."
        defaultChecked={contact?.isPrimary ?? false}
      />
      <FormActions>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm" loading={save.pending}>
          {contact ? 'Save contact' : 'Add contact'}
        </Button>
      </FormActions>
    </form>
  );
}

export function ContactsCard({
  partnerId,
  contacts,
  canEdit,
}: {
  partnerId: string;
  contacts: readonly ContactRow[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<ContactRow | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ContactRow | null>(null);
  const remove = useAction(deleteContactAction, { onSuccess: () => setDeleting(null) });

  return (
    <Card>
      <CardHeader
        title="Contacts"
        count={contacts.length}
        icon={<Users className="size-4" />}
        actions={
          canEdit ? (
            <Button size="xs" variant="secondary" onClick={() => setEditing('new')}>
              <Plus className="size-3.5" />
              Add
            </Button>
          ) : null
        }
      />
      {contacts.length === 0 ? (
        <Empty
          title="No contacts yet"
          description="Add the people we talk to at this partner."
          className="py-8"
        />
      ) : (
        <ul className="divide-line divide-y">
          {contacts.map((contact) => (
            <li key={contact.id} className="group flex items-start gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-ink flex items-center gap-1.5 text-[13.5px] font-medium">
                  {contact.name}
                  {contact.isPrimary && (
                    <Badge tone="accent" size="sm">
                      <Star className="size-3" />
                      Primary
                    </Badge>
                  )}
                </p>
                {contact.title && <p className="text-muted text-[12.5px]">{contact.title}</p>}
                <div className="text-muted mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px]">
                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="hover:text-accent-ink inline-flex items-center gap-1"
                    >
                      <Mail className="size-3.5" />
                      {contact.email}
                    </a>
                  )}
                  {contact.phone && (
                    <a
                      href={`tel:${contact.phone}`}
                      className="hover:text-accent-ink inline-flex items-center gap-1"
                    >
                      <Phone className="size-3.5" />
                      {contact.phone}
                    </a>
                  )}
                  {contact.linkedin && (
                    <a
                      href={contact.linkedin}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="hover:text-accent-ink inline-flex items-center gap-1"
                    >
                      <Linkedin className="size-3.5" />
                      LinkedIn
                    </a>
                  )}
                </div>
                {contact.notes && (
                  <p className="text-ink-soft mt-1 whitespace-pre-line text-[12.5px]">
                    {contact.notes}
                  </p>
                )}
              </div>
              {canEdit && (
                <div className="flex shrink-0 gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
                  <IconButton
                    label={`Edit ${contact.name}`}
                    size="sm"
                    onClick={() => setEditing(contact)}
                  >
                    <Pencil className="size-3.5" />
                  </IconButton>
                  <IconButton
                    label={`Remove ${contact.name}`}
                    size="sm"
                    onClick={() => setDeleting(contact)}
                  >
                    <Trash2 className="size-3.5" />
                  </IconButton>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add contact' : `Edit ${editing?.name ?? 'contact'}`}
      >
        {editing !== null && (
          <ContactForm
            key={editing === 'new' ? 'new' : editing.id}
            partnerId={partnerId}
            contact={editing === 'new' ? null : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && void remove.run({ id: deleting.id })}
        title={`Remove ${deleting?.name ?? 'contact'}?`}
        description="Their details are deleted. Notes already logged stay in the timeline."
        confirmLabel="Remove"
        variant="danger"
        busy={remove.pending}
      />
    </Card>
  );
}
