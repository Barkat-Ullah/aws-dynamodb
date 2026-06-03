export const getS3KeyFromUrl = (url: string) => {
  return url.substring(url.lastIndexOf("/") + 1);
};