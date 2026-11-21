// ★ アンケートの回答（answer.{ユーザーID}）の読み書きの形。
//   ・単一選択（既存と同じ）：選んだ番号（数字）。例：answer.user1 = 2
//   ・複数選択（【SPAで追加】）：選んだ番号の配列（小さい順）。例：answer.user1 = [0, 2]。メッセージに、multiple: true が付く。
//   単一選択のメッセージは、これまでと、まったく同じ形（multiple の項目は、付けない）。

/** 回答（数字、または番号の配列）を、番号の配列にする。形が違うものは、無視する。 */
export function toIndices(value: unknown): number[] {
	if (typeof value === 'number') return [value]
	if (Array.isArray(value)) return value.filter((n): n is number => typeof n === 'number').sort((a, b) => a - b)
	return []
}

/** この回答は、その選択肢を選んでいるか。 */
export function answerIncludes(value: unknown, choiceIndex: number): boolean {
	return toIndices(value).includes(choiceIndex)
}

/** 2つの選択（番号の配列）が、同じか（順番は、問わない）。 */
export function sameIndices(a: number[], b: number[]): boolean {
	if (a.length !== b.length) return false
	const sortedA = [...a].sort((x, y) => x - y)
	const sortedB = [...b].sort((x, y) => x - y)
	return sortedA.every((n, i) => n === sortedB[i])
}
