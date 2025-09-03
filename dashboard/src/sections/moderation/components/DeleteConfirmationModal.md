# DeleteConfirmationModal Component

A reusable modal component for delete confirmations across the moderation dashboard.

## Usage

```jsx
import DeleteConfirmationModal from '../components/DeleteConfirmationModal';

function MyComponent() {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const handleDelete = (item) => {
    setItemToDelete(item);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      // Your delete API call here
      await deleteItem(itemToDelete.id);
      setShowDeleteModal(false);
      setItemToDelete(null);
      // Show success toast
    } catch (error) {
      // Show error toast
    }
    setIsDeleting(false);
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setItemToDelete(null);
  };

  return (
    <>
      {/* Your component content */}
      <button onClick={() => handleDelete(item)}>Delete</button>

      {/* Delete Modal */}
      <DeleteConfirmationModal
        show={showDeleteModal}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        isDeleting={isDeleting}
        title="Delete Item"
        message="Are you sure you want to delete this item?"
        warningMessage="This action cannot be undone."
        confirmButtonText="Delete Item"
        itemDetails={itemToDelete && (
          <div>
            <strong>{itemToDelete.name}</strong>
            <div className="text-muted small">{itemToDelete.description}</div>
          </div>
        )}
      />
    </>
  );
}
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `show` | boolean | required | Controls modal visibility |
| `onClose` | function | required | Called when modal should close |
| `onConfirm` | function | required | Called when delete is confirmed |
| `isDeleting` | boolean | `false` | Shows loading state during deletion |
| `title` | string | `"Confirm Deletion"` | Modal title |
| `message` | string | `"Are you sure you want to delete this item?"` | Main confirmation message |
| `warningMessage` | string | `"This action cannot be undone."` | Warning text (set to null to hide) |
| `confirmButtonText` | string | `"Delete"` | Text for confirm button |
| `cancelButtonText` | string | `"Cancel"` | Text for cancel button |
| `itemDetails` | JSX | `null` | Custom content showing item details |

## Examples

### Simple Delete
```jsx
<DeleteConfirmationModal
  show={showModal}
  onClose={() => setShowModal(false)}
  onConfirm={handleDelete}
  message="Delete this user?"
/>
```

### Custom Details
```jsx
<DeleteConfirmationModal
  show={showModal}
  onClose={cancelDelete}
  onConfirm={confirmDelete}
  title="Delete Role"
  message="Are you sure you want to delete this role?"
  itemDetails={(
    <div>
      <div className="fw-bold text-primary">{role.name}</div>
      <div className="text-muted small">
        {role.memberCount} members will lose this role
      </div>
    </div>
  )}
/>
```

### No Warning
```jsx
<DeleteConfirmationModal
  show={showModal}
  onClose={cancelDelete}
  onConfirm={confirmDelete}
  warningMessage={null}
  message="Remove this item from favorites?"
  confirmButtonText="Remove"
/>
```
