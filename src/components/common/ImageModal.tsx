import { Dialog, DialogContent } from "@/components/ui/dialog";

interface ImageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  alt: string;
}

const ImageModal = ({ open, onOpenChange, src, alt }: ImageModalProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90vh] max-w-[90vw] border-theme-card bg-surface-card p-0 text-theme-primary sm:max-w-3xl">
      <div className="flex h-full w-full items-center justify-center p-4">
        <img src={src} alt={alt} className="max-h-[80vh] w-full object-contain" />
      </div>
    </DialogContent>
  </Dialog>
);

export default ImageModal;
