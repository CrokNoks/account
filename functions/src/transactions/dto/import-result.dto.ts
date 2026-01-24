export class ImportResultDto {
  total_rows!: number;
  imported_count!: number;
  skipped_count!: number;
  errors!: string[];
  imported_ids!: string[];
}