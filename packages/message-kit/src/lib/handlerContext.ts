import { Conversation, DecodedMessage, Client } from "@xmtp/mls-client";
import {
  DecodedMessage as DecodedMessageV2,
  Client as ClientV2,
} from "@xmtp/xmtp-js";
import type { Reaction } from "@xmtp/content-type-reaction";
import { populateUsernames } from "../helpers/usernames.js";
import { ContentTypeText } from "@xmtp/content-type-text";
import {
  CommandGroup,
  User,
  CommandHandlers,
  AgentHandlers,
  MessageAbstracted,
} from "../helpers/types.js";
import { parseIntent } from "../helpers/commands.js";
import { ContentTypeReply } from "@xmtp/content-type-reply";
import {
  ContentTypeRemoteAttachment,
  RemoteAttachmentCodec,
} from "@xmtp/content-type-remote-attachment";

import { NapiCreateGroupOptions } from "@xmtp/mls-client-bindings-node";
import { ContentTypeReaction } from "@xmtp/content-type-reaction";

export default class HandlerContext {
  message!: MessageAbstracted;
  conversation!: Conversation;
  client!: Client;
  v2client!: ClientV2;
  commands?: CommandGroup[];
  members?: User[];
  commandHandlers?: CommandHandlers;
  agentHandlers?: AgentHandlers;
  getMessageById!: (id: string) => DecodedMessage | null;
  newConversation!: (
    accountAddresses: string[],
    options?: NapiCreateGroupOptions,
  ) => Promise<Conversation>;

  private constructor(
    conversation: Conversation,
    message: DecodedMessage | DecodedMessageV2,
    { client, v2client }: { client: Client; v2client: ClientV2 },
    commands?: CommandGroup[],
    commandHandlers?: CommandHandlers,
    agentHandlers?: AgentHandlers,
  ) {
    this.client = client;
    this.v2client = v2client;
    this.conversation = conversation;
    this.commandHandlers = commandHandlers;
    this.agentHandlers = agentHandlers;
    this.commands = commands;
  }

  static async create(
    conversation: Conversation,
    message: DecodedMessage | DecodedMessageV2,
    { client, v2client }: { client: Client; v2client: ClientV2 },
    commands?: CommandGroup[],
    commandHandlers?: CommandHandlers,
    agentHandlers?: AgentHandlers,
  ): Promise<HandlerContext> {
    const context = new HandlerContext(
      conversation,
      message,
      { client, v2client },
      commands,
      commandHandlers,
      agentHandlers,
    );

    //v2
    const senderAddress =
      "senderAddress" in message
        ? message.senderAddress
        : message.senderInboxId;
    const sentAt = "sentAt" in message ? message.sentAt : message.sent;

    context.members = await populateUsernames(
      conversation.members,
      client.accountAddress,
      senderAddress,
    );

    context.newConversation = client.conversations.newConversation.bind(
      client.conversations,
    );

    context.getMessageById =
      client.conversations?.getMessageById?.bind(client.conversations) ||
      (() => null);

    let content = message.content;
    if (message.contentType.sameAs(ContentTypeText)) {
      content = parseIntent(
        message?.content,
        commands ?? [],
        context.members ?? [],
      );
    } else if (message.contentType.sameAs(ContentTypeReply)) {
      content = {
        ...content,
        typeId: message.content.contentType.typeId,
      };
    } else if (message.contentType.sameAs(ContentTypeRemoteAttachment)) {
      const attachment = await RemoteAttachmentCodec.load(
        message.content,
        client,
      );
      content = {
        ...content,
        attachment: attachment,
      };
    }

    //v2
    const sender =
      context.members?.find((member) => member.inboxId === senderAddress) ||
      ({ address: senderAddress, inboxId: senderAddress } as User);

    context.message = {
      id: message.id,
      content: content,
      sender: sender,
      typeId: message.contentType.typeId,
      sent: sentAt,
    };

    return context;
  }

  async reply(message: string) {
    const reply = {
      content: message,
      contentType: ContentTypeText,
      reference: this.message.id,
    };
    await this.conversation.send(reply, ContentTypeReply);
  }

  async send(message: string) {
    await this.conversation.send(message);
  }

  async react(emoji: string) {
    const reaction: Reaction = {
      action: "added",
      schema: "unicode",
      reference: this.message.id,
      content: emoji,
    };

    await this.conversation.send(reaction, ContentTypeReaction);
  }

  async sendTo(message: string, receivers: string[]) {
    for (const receiver of receivers) {
      if (this.v2client.address.toLowerCase() === receiver.toLowerCase())
        continue;
      const targetConversation =
        await this.v2client.conversations.newConversation(receiver);
      await targetConversation.send(message);
    }
  }

  async intent(
    messages: string,
    options?: {
      conversation?: Conversation;
      receivers?: string[];
      return?: boolean;
    },
  ) {
    let splitMessages = [messages];
    try {
      if (Array.isArray(JSON.parse(messages)))
        splitMessages = JSON.parse(messages);
      if (process?.env?.MSG_LOG === "true") {
        console.log("splitMessages", splitMessages);
      }
    } catch (e) {}
    if (options?.return) {
      return splitMessages;
    }
    for (const message of splitMessages) {
      const msg = message as string;
      if (msg.startsWith("/")) {
        await this.handleCommand(msg);
      } else {
        await this.reply(msg);
      }
    }
  }
  private async handleCommand(text: string) {
    const { commands, members } = this;
    if (text.startsWith("/")) {
      let content = parseIntent(text, commands ?? [], members ?? []);
      // Mock context for command execution
      const mockContext: HandlerContext = {
        ...this,
        message: {
          ...this.message,
          content,
        },
        intent: this.intent.bind(this),
        reply: this.reply.bind(this),
        send: this.send.bind(this),
        sendTo: this.sendTo.bind(this),
        react: this.react.bind(this),
      };
      const handler =
        this.commandHandlers?.[
          text.split(" ")[0] as keyof typeof this.commandHandlers
        ];
      if (handler) {
        await handler(mockContext);
      } else {
        await this.reply(
          "Unknown command. Type /help for a list of available commands.",
        );
      }
    } else {
      await this.reply(`${text}`);
    }
    return text;
  }
}
