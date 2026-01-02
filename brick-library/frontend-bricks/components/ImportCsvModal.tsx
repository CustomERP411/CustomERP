import Modal from '../ui/Modal';
import ImportCsvTool, { type FieldDefinition } from './ImportCsvTool';

interface ImportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  entitySlug: string;
  fields: FieldDefinition[];
  onImported: () => void;
}

export default function ImportCsvModal({ isOpen, onClose, entitySlug, fields, onImported }: ImportCsvModalProps) {
  return (
    <Modal isOpen={isOpen} title={'Import CSV → ' + entitySlug} onClose={onClose}>
      <ImportCsvTool entitySlug={entitySlug} fields={fields} onCancel={onClose} onDone={onImported} />
    </Modal>
  );
}


