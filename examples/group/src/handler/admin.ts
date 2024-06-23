import { HandlerContext } from "@xmtp/message-kit";

// Reusable function to handle adding members
function handleAddMembers(addedInboxes: any, members: any, adminName: any) {
  const addedNames = members
    ?.filter((member: any) =>
      addedInboxes.some(
        (added: any) =>
          added.inboxId.toLowerCase() === member?.inboxId?.toLowerCase(),
      ),
    )
    .map((member: any) => `@${member.username}`)
    .filter((name: any) => name.trim() !== "@") // Filter out empty or undefined usernames
    .join(", "); // Join names for message formatting

  if (addedNames && addedNames.trim().length > 0) {
    let messages = [
      `Welcome, ${addedNames}! 🎉 @${adminName} created a new token for you!`,
      `Hey ${addedNames}! 👋 @${adminName} says you’re going to the moon with us!`,
      `Welcome, ${addedNames}! 🛳️ @${adminName} added you to the whitelist!`,
      `${addedNames}, welcome to the group! 😎 @${adminName} says it's fully decentralized!`,
      `${addedNames}, you've joined the chat! 🚀 @${adminName} saved your place in the group!`,
      `Hey ${addedNames}, welcome! 🎉 @${adminName} saved some gas fees for you!`,
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }
  return "";
}
function handleRemoveMembers(adminName: any) {
  let messages = [
    `See ya! 👋 Don't let the blockchain hit you on the way out, says @${adminName}.`,
    `@${adminName} won't miss the buggy code!`,
    `🪦`,
    `☠️☠️☠️`,
    `💀`,
    `👻`,
    `hasta la vista, baby`,
    `nuked ☠️💣, by @${adminName}`,
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}
const handleGroupname = (newValue: any, adminName: any) => {
  let messages = [
    `The group name was just renamed to '${newValue}'! 📝 Now @${adminName} is scrambling to update the smart contracts!`,
    `The group name has changed to '${newValue}'! 🎉 @${adminName} is now rewriting the blockchain in panic!`,
    `A new group name has been decided to '${newValue}'! 🔄 @${adminName} is checking if it's hashable!`,
    `Look out! The group name is now '${newValue}'! 🕵️‍♂️ @${adminName} is on a secret mission to encode it!`,
    `It's official, '${newValue}' is the new group name! 🚀 @${adminName} is already launching it into the crypto space!`,
    `Say hello to our new group name, '${newValue}'! 🎭 @${adminName} is preparing the disguise kits!`,
    `We've updated our group name to '${newValue}'! 🧙‍♂️ Watch as @${adminName} casts a renaming spell!`,
    `New group name alert: '${newValue}'! 🚨 @${adminName} is setting up the alarm systems!`,
    `Welcome to the newly named '${newValue}'! 🌐 @${adminName} is spinning the globe for this one!`,
    `The group has a fresh start as '${newValue}'! 🌱 @${adminName} is planting the seeds for growth!`,
  ];
  return messages[Math.floor(Math.random() * messages.length)];
};
export async function handler(context: HandlerContext) {
  const {
    conversation,
    members,
    message: { content, typeId },
  } = context;
  if (typeId === "group_updated") {
    const {
      initiatedByInboxId,
      metadataFieldChanges,
      removedInboxes,
      addedInboxes,
    } = content;
    // Fetch username from members array mapped by inboxId
    const adminName =
      members?.find((member) => member.inboxId === initiatedByInboxId)
        ?.username || "Admin";

    let message: string = "";
    if (addedInboxes.length > 0) {
      message += handleAddMembers(addedInboxes, members, adminName);
    } else if (removedInboxes.length > 0) {
      console.log(removedInboxes);
      message += handleRemoveMembers(adminName);
      console.log(message);
    } else if (metadataFieldChanges && metadataFieldChanges[0]) {
      const { fieldName, newValue } = metadataFieldChanges?.[0];
      if (fieldName === "group_name") {
        message += handleGroupname(newValue, adminName);
      }
    }
    context.reply(message);
  } else if (typeId === "text") {
    const {
      params: { type, username, address, name },
    } = content;
    switch (type) {
      case "name":
        try {
          await conversation.updateName(name);
          const messages = handleGroupname(name, "bot");
          context.reply(messages);
        } catch (error) {
          context.reply("No admin priviliges");
          console.error(error);
        }
        break;
      case "remove":
        try {
          const userArrays = username.map((user: any) => user.address);
          await conversation.sync();
          console.log("userArrays", userArrays);
          await conversation.removeMembers(userArrays);
          const messages = handleRemoveMembers("bot");
          context.reply(messages);
        } catch (error) {
          context.reply("User doesnt exist or admin priviliges");
          console.error(error);
        }
        break;
      case "add":
        try {
          const addedInboxes = username.map((user: any) =>
            user.inboxId.toLowerCase(),
          );
          console.log(addedInboxes);
          await conversation.sync();
          await conversation.addMembersByInboxId(addedInboxes);
          await conversation.sync();
          const messages = handleAddMembers(
            [{ inboxId: addedInboxes[0] }],
            members,
            "bot",
          );
          context.reply(messages);
        } catch (error) {
          context.reply("User already exists or admin priviliges");
          console.error(error);
        }
        break;
    }
  }
  return;
}
