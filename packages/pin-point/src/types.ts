export type PinComment = {
  id: string;
  url: string;
  content: string;
  anchor: {
    selector: string;
    xPercent: number;
    yPercent: number;
  };
  viewport: {
    width: number;
  };
  createdAt: string;
};

export type AnchorData = {
  selector: string;
  xPercent: number;
  yPercent: number;
};

export type PendingPin = {
  x: number;
  y: number;
  anchor: AnchorData;
};

export type FeedbackOverlayProps = {
  onCommentCreate: (comment: PinComment) => Promise<void>;
  onCommentsFetch: () => Promise<PinComment[]>;
  queryParam?: string;
  children: React.ReactNode;
};
