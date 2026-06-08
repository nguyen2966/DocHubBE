export type InviteResultStatus =
  | 'invited'            // gửi invitation thành công
  | 'already_member'     // đã là thành viên active
  | 'already_invited'    // đang có pending invitation (re-sent)
  | 'error'              // lỗi bất ngờ với email này
 
export interface InviteEmailResult {
  email: string
  status: InviteResultStatus
  invitationId?: string  // có khi status = 'invited' | 'already_invited'
}
 