// @ts-nocheck
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/shadcn/ui/command";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/shadcn/ui/context-menu";
import { BlockNoteEditor, PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { CheckCircleIcon } from "@heroicons/react/20/solid";
import { getCookie } from "cookies-next";
import moment from "moment";
import useTranslation from "next-translate/useTranslation";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import Frame from "react-frame-component";
import { useQuery } from "react-query";
import { useDebounce } from "use-debounce";

import { toast } from "@/shadcn/hooks/use-toast";
import { hasAccess } from "@/shadcn/lib/hasAccess";
import { cn } from "@/shadcn/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/shadcn/ui/avatar";
import { Button } from "@/shadcn/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shadcn/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/shadcn/ui/popover";
import { Switch } from "@/shadcn/ui/switch";
import {
  CheckIcon,
  CircleCheck,
  CircleDotDashed,
  Ellipsis,
  Eye,
  EyeOff,
  LifeBuoy,
  Loader,
  LoaderCircle,
  Lock,
  PanelTopClose,
  Trash2,
  Unlock,
} from "lucide-react";
import { useUser } from "../../store/session";
import { ClientCombo, IconCombo, UserCombo } from "../Combo";

const ticketStatusMap = [
  { id: 0, value: "hold", name: "Hold", icon: CircleDotDashed },
  { id: 1, value: "needs_support", name: "Needs Support", icon: LifeBuoy },
  { id: 2, value: "in_progress", name: "In Progress", icon: CircleDotDashed },
  { id: 3, value: "in_review", name: "In Review", icon: Loader },
  { id: 4, value: "done", name: "Done", icon: CircleCheck },
];

export default function Ticket() {
  const router = useRouter();
  const { t } = useTranslation("peppermint");
  const token = getCookie("session");
  const { user } = useUser();

  const fetchTicketById = async () => {
    const id = router.query.id;
    const res = await fetch(`/api/v1/ticket/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    hasAccess(res);
    return res.json();
  };

  const { data, status, refetch } = useQuery("fetchTickets", fetchTicketById, {
    enabled: false,
  });

  useEffect(() => {
    refetch();
  }, [router]);

  const [initialContent, setInitialContent] = useState<
    PartialBlock[] | undefined | "loading"
  >("loading");

  const editor = useMemo(() => {
    if (initialContent === "loading") return undefined;
    return BlockNoteEditor.create({ initialContent });
  }, [initialContent]);

  const [users, setUsers] = useState<any>();
  const [clients, setClients] = useState<any>();
  const [n, setN] = useState<any>();
  const [note, setNote] = useState<any>();
  const [issue, setIssue] = useState<any>();
  const [title, setTitle] = useState<any>();
  const [ticketStatus, setTicketStatus] = useState<any>();
  const [comment, setComment] = useState<any>();
  const [timeSpent, setTimeSpent] = useState<any>();
  const [publicComment, setPublicComment] = useState<any>(false);
  const [timeReason, setTimeReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [assignedClient, setAssignedClient] = useState<any>();

  const history = useRouter();
  const { id } = history.query;

  async function update() {
    if (data && data.ticket && data.ticket.locked) return;
    const res = await fetch(`/api/v1/ticket/update`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id,
        detail: JSON.stringify(debouncedValue),
        note,
        title: debounceTitle,
        status: ticketStatus?.value,
      }),
    }).then((res) => res.json());

    if (!res.success) {
      toast({ variant: "destructive", title: "Error", description: res.message || "Failed to update ticket" });
      return;
    }
  }

  async function updateStatus() {
    if (data && data.ticket && data.ticket.locked) return;
    const res = await fetch(`/api/v1/ticket/status/update`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: !data.ticket.isComplete, id }),
    }).then((res) => res.json());
    if (!res.success) {
      toast({ variant: "destructive", title: "Error", description: res.message || "Failed to update status" });
      return;
    }
    refetch();
  }

  async function hide(hidden) {
    if (data && data.ticket && data.ticket.locked) return;
    const res = await fetch(`/api/v1/ticket/status/hide`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ hidden, id }),
    }).then((res) => res.json());
    if (!res.success) {
      toast({ variant: "destructive", title: "Error", description: res.message || "Failed to update visibility" });
      return;
    }
    refetch();
  }

  async function lock(locked) {
    const res = await fetch(`/api/v1/ticket/status/lock`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ locked, id }),
    }).then((res) => res.json());
    if (!res.success) {
      toast({ variant: "destructive", title: "Error", description: res.message || "Failed to update lock status" });
      return;
    }
    refetch();
  }

  async function deleteIssue() {
    await fetch(`/api/v1/ticket/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          toast({ variant: "default", title: "Issue Deleted", description: "The issue has been deleted" });
          router.push("/issues");
        }
      });
  }

  async function addComment() {
    if (data && data.ticket && data.ticket.locked) return;
    const res = await fetch(`/api/v1/ticket/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text: comment, id, public: publicComment }),
    }).then((res) => res.json());
    if (!res.success) {
      toast({ variant: "destructive", title: "Error", description: res.message || "Failed to add comment" });
      return;
    }
    refetch();
  }

  async function deleteComment(id: string) {
    await fetch(`/api/v1/ticket/comment/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    })
      .then((res) => res.json())
      .then((res) => {
        if (res.success) {
          refetch();
        } else {
          toast({ variant: "destructive", title: "Error", description: "Failed to delete comment" });
        }
      });
  }

  async function fetchUsers() {
    const res = await fetch(`/api/v1/users/all`, {
      method: "GET",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    }).then((res) => res.json());
    if (res.users) setUsers(res.users);
  }

  async function fetchClients() {
    const res = await fetch(`/api/v1/clients/all`, {
      method: "GET",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    }).then((res) => res.json());
    if (res.clients) setClients(res.clients);
  }

  async function subscribe() {
    if (data && data.ticket && data.ticket.locked) return;
    const isFollowing = data.ticket.following?.includes(user.id);
    const action = isFollowing ? "unsubscribe" : "subscribe";
    const res = await fetch(`/api/v1/ticket/${action}/${id}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    }).then((res) => res.json());
    if (!res.success) {
      toast({ variant: "destructive", title: "Error", description: res.message || `Failed to ${action}` });
      return;
    }
    toast({
      title: isFollowing ? "Unsubscribed" : "Subscribed",
      description: isFollowing ? "You will no longer receive updates" : "You will now receive updates",
      duration: 3000,
    });
    refetch();
  }

  async function transferTicket() {
    if (data && data.ticket && data.ticket.locked) return;
    if (n === undefined) return;
    const res = await fetch(`/api/v1/ticket/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ user: n ? n.id : undefined, id }),
    }).then((res) => res.json());
    if (!res.success) {
      toast({ variant: "destructive", title: "Error", description: res.message || "Failed to transfer ticket" });
      return;
    }
    refetch();
  }

  async function transferClient() {
    if (data && data.ticket && data.ticket.locked) return;
    if (assignedClient === undefined) return;
    const res = await fetch(`/api/v1/ticket/transfer/client`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ client: assignedClient ? assignedClient.id : undefined, id }),
    }).then((res) => res.json());
    if (!res.success) {
      toast({ variant: "destructive", title: "Error", description: res.message || "Failed to transfer client" });
      return;
    }
    refetch();
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("user", user.id);
      try {
        const result = await fetch(`/api/v1/storage/ticket/${router.query.id}/upload/single`, {
          method: "POST",
          body: formData,
        });
        const data = await result.json();
        if (data.success) { setFile(null); refetch(); }
      } catch (error) {
        console.error(error);
      }
    }
  };

  const fileInputRef = useRef(null);

  useEffect(() => { handleUpload(); }, [file]);
  useEffect(() => { fetchUsers(); fetchClients(); }, []);
  useEffect(() => { transferTicket(); }, [n]);
  useEffect(() => { transferClient(); }, [assignedClient]);

  const [debouncedValue] = useDebounce(issue, 500);
  const [debounceTitle] = useDebounce(title, 500);

  useEffect(() => { update(); }, [ticketStatus, debounceTitle]);
  useEffect(() => { if (issue) update(); }, [debouncedValue]);

  async function loadFromStorage() {
    const storageString = data.ticket.detail as PartialBlock[];
    try {
      return JSON.parse(storageString) as PartialBlock[];
    } catch (e) {
      return undefined;
    }
  }

  async function convertHTML() {
    const blocks = (await editor.tryParseHTMLToBlocks(data.ticket.detail)) as PartialBlock[];
    editor.replaceBlocks(editor.document, blocks);
  }

  useEffect(() => {
    if (status === "success" && data && data.ticket) {
      loadFromStorage().then((content) => {
        if (typeof content === "object") {
          setInitialContent(content);
        } else {
          setInitialContent(undefined);
        }
      });
    }
  }, [status, data]);

  useEffect(() => {
    if (initialContent === undefined) convertHTML();
  }, [initialContent]);

  if (editor === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoaderCircle className="animate-spin" />
      </div>
    );
  }

  const handleInputChange = (editor) => {
    if (data.ticket.locked) return;
    setIssue(editor.document);
  };

  async function updateTicketStatus(e: any, ticket: any) {
    await fetch(`/api/v1/ticket/status/update`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: ticket.id, status: !ticket.isComplete }),
    })
      .then((res) => res.json())
      .then(() => {
        toast({
          title: ticket.isComplete ? "Issue re-opened" : "Issue closed",
          description: "The status of the issue has been updated.",
          duration: 3000,
        });
        refetch();
      });
  }

  async function updateTicketAssignee(ticketId: string, user: any) {
    try {
      const response = await fetch(`/api/v1/ticket/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ user: user ? user.id : undefined, id: ticketId }),
      });
      if (!response.ok) throw new Error("Failed to update assignee");
      toast({ title: "Assignee updated", description: "Transferred issue successfully", duration: 3000 });
      refetch();
    } catch (error) {
      toast({ title: "Error", description: "Failed to update assignee", variant: "destructive", duration: 3000 });
    }
  }

  // Engineers display component
  const EngineersDisplay = () => {
    if (!data.ticket.engineers || data.ticket.engineers.length === 0) return null;
    return (
      <div className="mt-2 px-2">
        <span className="text-xs text-muted-foreground">Assigned Engineers:</span>
        <div className="flex flex-col space-y-1 mt-1">
          {data.ticket.engineers.map((eng: any) => (
            <span key={eng.id} className="text-sm font-medium">{eng.name}</span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      {status === "loading" && (
        <div className="min-h-screen flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8">
          <h2>Loading data ...</h2>
        </div>
      )}

      {status === "error" && (
        <div className="min-h-screen flex flex-col justify-center items-center py-12 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold">Error fetching data ...</h2>
        </div>
      )}

      {status === "success" && (
        <ContextMenu>
          <ContextMenuTrigger>
            <main className="flex-1 min-h-[90vh] py-8">
              <div className="mx-auto max-w-7xl w-full px-4 flex flex-col lg:flex-row justify-center">
                {/* Left Column */}
                <div className="lg:border-r lg:pr-8 lg:w-2/3">
                  <div className="md:flex md:justify-between md:space-x-4 lg:border-b lg:pb-4">
                    <div className="w-full">
                      <div className="flex flex-row space-x-1">
                        <h1 className="text-2xl mt-[5px] font-bold text-foreground">
                          #{data.ticket.Number} -
                        </h1>
                        <input
                          type="text"
                          name="title"
                          id="title"
                          style={{ fontSize: "1.5rem" }}
                          className="border-none -mt-[1px] px-0 pl-0.5 w-3/4 truncated m block text-foreground bg-transparent font-bold focus:outline-none focus:ring-0 placeholder:text-primary sm:text-sm sm:leading-6"
                          value={title}
                          defaultValue={data.ticket.title}
                          onChange={(e) => setTitle(e.target.value)}
                          key={data.ticket.id}
                          disabled={data.ticket.locked}
                        />
                      </div>
                      <div className="mt-2 text-xs flex flex-row justify-between items-center space-x-1">
                        <div className="flex flex-row space-x-1 items-center">
                          {data.ticket.client && (
                            <span className="inline-flex items-center rounded-md bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-600/20">
                              {data.ticket.client.name}
                            </span>
                          )}
                          {!data.ticket.isComplete ? (
                            <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                              {t("open_issue")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/10">
                              {t("closed_issue")}
                            </span>
                          )}
                          <span className="inline-flex items-center rounded-md bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700 ring-1 ring-inset ring-orange-600/20">
                            {data.ticket.type}
                          </span>
                          {data.ticket.hidden && (
                            <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">
                              Hidden
                            </span>
                          )}
                          {data.ticket.locked && (
                            <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
                              Locked
                            </span>
                          )}
                        </div>
                        {user.isAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex items-center px-2 py-1 text-xs font-medium text-foreground ring-none outline-none">
                              <Ellipsis className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[160px]">
                              <DropdownMenuLabel>Issue Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {data.ticket.hidden ? (
                                <DropdownMenuItem className="flex flex-row space-x-3 items-center" onClick={() => hide(false)}>
                                  <Eye className="h-4 w-4" />
                                  <span>Show Issue</span>
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem className="flex flex-row space-x-3 items-center" onClick={() => hide(true)}>
                                  <EyeOff className="h-4 w-4" />
                                  <span>Hide Issue</span>
                                </DropdownMenuItem>
                              )}
                              {data.ticket.locked ? (
                                <DropdownMenuItem className="flex flex-row space-x-3 items-center" onClick={() => lock(false)}>
                                  <Unlock className="h-4 w-4" />
                                  <span>Unlock Issue</span>
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem className="flex flex-row space-x-3 items-center" onClick={() => lock(true)}>
                                  <Lock className="h-4 w-4" />
                                  <span>Lock Issue</span>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="flex flex-row space-x-3 items-center transition-colors duration-200 focus:bg-red-500 focus:text-white"
                                onClick={() => deleteIssue()}
                              >
                                <Trash2 className="h-4 w-4" />
                                <span>Delete Issue</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Mobile sidebar */}
                  <aside className="mt-4 lg:hidden">
                    <div className="border-b pb-1">
                      <div className="border-t pt-1">
                        <div className="flex flex-col sm:flex-row space-x-2">
                          <div className="ml-2">
                            {users && (
                              <UserCombo
                                value={users}
                                update={setN}
                                defaultName={data.ticket.assignedTo ? data.ticket.assignedTo.name : ""}
                                disabled={data.ticket.locked}
                                placeholder="Assign User..."
                                hideInitial={false}
                                showIcon={true}
                              />
                            )}
                            <EngineersDisplay />
                          </div>
                          <IconCombo
                            value={ticketStatusMap}
                            update={setTicketStatus}
                            defaultName={data.ticket.status ? data.ticket.status : ""}
                            disabled={data.ticket.locked}
                            showIcon={true}
                            placeholder="Change Status..."
                            hideInitial={false}
                          />
                        </div>
                      </div>
                    </div>
                  </aside>

                  <div className="py-3 xl:pb-0 xl:pt-2">
                    <div className="prose max-w-none mt-2">
                      {!data.ticket.fromImap ? (
                        <BlockNoteView
                          editor={editor}
                          sideMenu={false}
                          className="m-0 p-0 bg-transparent dark:text-white"
                          onChange={handleInputChange}
                          editable={!data.ticket.locked}
                        />
                      ) : (
                        <div className="break-words bg-white rounded-md text-black">
                          <Frame
                            className="min-h-[60vh] h-full max-h-[80vh] overflow-y-auto w-full"
                            initialContent={data.ticket.detail}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <section aria-labelledby="activity-title" className="border-t mt-4">
                    <div className="p-2 flex flex-col space-y-1">
                      <div className="flex flex-row items-center justify-between">
                        <span id="activity-title" className="text-base font-medium">Activity</span>
                        <div className="flex flex-row items-center space-x-2">
                          <Button
                            variant="ghost"
                            onClick={() => subscribe()}
                            size="sm"
                            className="flex items-center gap-1 group"
                          >
                            {data.ticket.following?.includes(user.id) ? (
                              <>
                                <span className="text-xs group-hover:hidden">following</span>
                                <span className="text-xs hidden group-hover:inline text-destructive">unsubscribe</span>
                              </>
                            ) : (
                              <span className="text-xs">follow</span>
                            )}
                          </Button>
                          {data.ticket.following && data.ticket.following.length > 0 && (
                            <div className="flex space-x-2">
                              <Popover>
                                <PopoverTrigger>
                                  <PanelTopClose className="h-4 w-4" />
                                </PopoverTrigger>
                                <PopoverContent>
                                  <div className="flex flex-col space-y-1">
                                    <span className="text-xs">Followers</span>
                                    {data.ticket.following.map((follower: any) => {
                                      const userMatch = users?.find(
                                        (u) => u.id === follower && u.id !== data.ticket.assignedTo?.id
                                      );
                                      return userMatch ? (
                                        <div key={follower}>
                                          <span>{userMatch.name}</span>
                                        </div>
                                      ) : null;
                                    })}
                                    {data.ticket.following.filter(
                                      (follower: any) => follower !== data.ticket.assignedTo?.id
                                    ).length === 0 && (
                                      <span className="text-xs">This issue has no followers</span>
                                    )}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        <div className="flex flex-row items-center text-sm space-x-1">
                          {data.ticket.fromImap ? (
                            <>
                              <span className="font-bold">{data.ticket.email}</span>
                              <span>created via email at</span>
                              <span className="font-bold">{moment(data.ticket.createdAt).format("DD/MM/YYYY")}</span>
                            </>
                          ) : (
                            <>
                              {data.ticket.createdBy ? (
                                <div className="flex flex-row space-x-1">
                                  <span>Created by <strong className="ml-1">{data.ticket.createdBy.name}</strong> at</span>
                                  <span>{moment(data.ticket.createdAt).format("LLL")}</span>
                                  {data.ticket.name && <span>for <strong>{data.ticket.name}</strong></span>}
                                  {data.ticket.email && <span>( <strong>{data.ticket.email}</strong> )</span>}
                                </div>
                              ) : (
                                <div className="flex flex-row space-x-1">
                                  <span>Created at</span>
                                  <strong>{moment(data.ticket.createdAt).format("LLL")}</strong>
                                  {data.ticket.client && <span>for <strong>{data.ticket.client.name}</strong></span>}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      <div>
                        <ul role="list" className="space-y-2">
                          {data.ticket.comments.length > 0 && data.ticket.comments.map((comment: any) => (
                            <li key={comment.id} className="group flex flex-col space-y-1 text-sm bg-secondary/50 px-4 py-2 rounded-lg relative">
                              <div className="flex flex-row space-x-2 items-center">
                                <Avatar className="w-6 h-6">
                                  <AvatarImage src={comment.user ? comment.user.image : ""} />
                                  <AvatarFallback>
                                    {comment.user ? comment.user.name.slice(0, 1) : comment.replyEmail.slice(0, 1)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-bold">{comment.user ? comment.user.name : comment.replyEmail}</span>
                                <span className="text-xs lowercase">{moment(comment.createdAt).format("LLL")}</span>
                                {(user.isAdmin || (comment.user && comment.userId === user.id)) && (
                                  <Trash2
                                    className="h-4 w-4 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-muted-foreground hover:text-destructive"
                                    onClick={() => deleteComment(comment.id)}
                                  />
                                )}
                              </div>
                              <span className="ml-1">{comment.text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="mt-6">
                        <div className="flex space-x-3">
                          <div className="min-w-0 flex-1">
                            <div>
                              <label htmlFor="comment" className="sr-only">{t("comment")}</label>
                              <textarea
                                id="comment"
                                name="comment"
                                rows={3}
                                className="block w-full bg-secondary/50 rounded-md border-0 py-1.5 shadow-sm ring-1 ring-inset ring-background focus:ring-0 sm:text-sm sm:leading-6"
                                placeholder={data.ticket.locked ? "This ticket is locked" : "Leave a comment"}
                                defaultValue={""}
                                onChange={(e) => setComment(e.target.value)}
                                disabled={data.ticket.locked}
                              />
                              <div className="mt-4 flex justify-end">
                                <div className="flex flex-row items-center space-x-2">
                                  <Switch checked={publicComment} onCheckedChange={setPublicComment} />
                                  <span>Public Reply</span>
                                </div>
                              </div>
                              <div className="mt-4 flex items-center justify-end space-x-4">
                                {data.ticket.isComplete ? (
                                  <button
                                    type="button"
                                    onClick={() => { if (!data.ticket.locked) updateStatus(); }}
                                    disabled={data.ticket.locked}
                                    className={`inline-flex justify-center items-center gap-x-1.5 rounded-md ${data.ticket.locked ? "bg-gray-300 cursor-not-allowed" : "bg-white hover:bg-gray-50"} px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300`}
                                  >
                                    <CheckCircleIcon className="-ml-0.5 h-5 w-5 text-red-500" aria-hidden="true" />
                                    <span>{t("reopen_issue")}</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => { if (!data.ticket.locked) updateStatus(); }}
                                    disabled={data.ticket.locked}
                                    className={`inline-flex justify-center gap-x-1.5 rounded-md ${data.ticket.locked ? "bg-gray-300 cursor-not-allowed" : "bg-white hover:bg-gray-50"} px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300`}
                                  >
                                    <CheckCircleIcon className="-ml-0.5 h-5 w-5 text-green-500" aria-hidden="true" />
                                    {t("close_issue")}
                                  </button>
                                )}
                                <button
                                  onClick={() => addComment()}
                                  type="submit"
                                  disabled={data.ticket.locked}
                                  className={`inline-flex items-center justify-center rounded-md px-4 py-1.5 text-sm font-semibold text-white shadow-sm ${data.ticket.locked ? "bg-gray-400 cursor-not-allowed" : "bg-gray-900 hover:bg-gray-700"}`}
                                >
                                  {t("comment")}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>

                {/* Right Column - Desktop Sidebar */}
                <div className="hidden lg:block lg:pl-8 lg:order-2 order-1">
                  <h2 className="sr-only">{t("details")}</h2>
                  <div className="space-y-1 py-2">
                    {users && (
                      <UserCombo
                        value={users}
                        update={setN}
                        defaultName={data.ticket.assignedTo ? data.ticket.assignedTo.name : ""}
                        disabled={data.ticket.locked}
                        showIcon={true}
                        placeholder="Change User..."
                        hideInitial={false}
                      />
                    )}
                    <EngineersDisplay />
                    <IconCombo
                      value={ticketStatusMap}
                      update={setTicketStatus}
                      defaultName={data.ticket.status ? data.ticket.status : ""}
                      disabled={data.ticket.locked}
                      hideInitial={false}
                    />
                    {clients && (
                      <ClientCombo
                        value={clients}
                        update={setAssignedClient}
                        defaultName={data.ticket.client ? data.ticket.client.name : "No Client Assigned"}
                        disabled={data.ticket.locked}
                        showIcon={true}
                        hideInitial={false}
                      />
                    )}
                  </div>
                </div>
              </div>
            </main>
          </ContextMenuTrigger>

          <ContextMenuContent className="w-52">
            <ContextMenuItem onClick={(e) => updateTicketStatus(e, data.ticket)}>
              {data.ticket.isComplete ? "Re-open Issue" : "Close Issue"}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuSub>
              <ContextMenuSubTrigger>Assign To</ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-64 ml-1 -mt-1/2">
                <Command>
                  <CommandList>
                    <CommandGroup heading="Assigned To">
                      <CommandItem onSelect={() => updateTicketAssignee(data.ticket.id, undefined)}>
                        <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", data.ticket.assignedTo === null ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                          <CheckIcon className={cn("h-4 w-4")} />
                        </div>
                        <span>Unassigned</span>
                      </CommandItem>
                      {users?.map((user) => (
                        <CommandItem key={user.id} onSelect={() => updateTicketAssignee(data.ticket.id, user)}>
                          <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", data.ticket.assignedTo?.name === user.name ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                            <CheckIcon className={cn("h-4 w-4")} />
                          </div>
                          <span>{user.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={(e) => {
                e.preventDefault();
                toast({ title: "Link copied to clipboard", description: "You can now share the link with others.", duration: 3000 });
                navigator.clipboard.writeText(`${window.location.origin}/issue/${data.ticket.id}`);
              }}
            >
              Share Link
            </ContextMenuItem>
            <ContextMenuSeparator />
            {user.isAdmin && (
              <ContextMenuItem className="text-red-600" onClick={(e) => deleteIssue()}>
                Delete Ticket
              </ContextMenuItem>
            )}
          </ContextMenuContent>
        </ContextMenu>
      )}
    </div>
  );
}