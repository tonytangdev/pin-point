import { Schema } from "effect";

export const AnchorSchema = Schema.Struct({
	selector: Schema.String,
	xPercent: Schema.Number,
	yPercent: Schema.Number,
});

export const ViewportSchema = Schema.Struct({
	width: Schema.Number,
});

export const PinCommentSchema = Schema.Struct({
	id: Schema.String,
	url: Schema.String,
	content: Schema.String,
	anchor: AnchorSchema,
	viewport: ViewportSchema,
	createdAt: Schema.String,
});

export type PinComment = typeof PinCommentSchema.Type;

export const CreateCommentSchema = Schema.Struct({
	url: Schema.String,
	content: Schema.String,
	anchor: AnchorSchema,
	viewport: ViewportSchema,
});

export type CreateComment = typeof CreateCommentSchema.Type;

export const UpdateCommentSchema = Schema.Struct({
	content: Schema.NonEmptyTrimmedString,
});

export type UpdateComment = typeof UpdateCommentSchema.Type;
