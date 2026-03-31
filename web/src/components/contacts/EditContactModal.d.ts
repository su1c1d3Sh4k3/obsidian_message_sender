interface Tag {
    id: string;
    name: string;
    color: string;
}
interface Contact {
    id: string;
    first_name: string | null;
    last_name: string | null;
    display_name: string;
    phone: string;
    email?: string | null;
    city: string | null;
    state: string | null;
    organization: string | null;
    notes?: string | null;
    contact_tags?: Array<{
        tags: Tag;
    }>;
}
interface Props {
    open: boolean;
    onClose: () => void;
    contact: Contact | null;
}
export default function EditContactModal({ open, onClose, contact }: Props): import("react/jsx-runtime").JSX.Element | null;
export {};
//# sourceMappingURL=EditContactModal.d.ts.map