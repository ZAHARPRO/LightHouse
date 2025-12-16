<?php

namespace App\Entity;

use App\Repository\UserRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Validator\Constraints\UniqueEntity;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserInterface;

#[ORM\Entity(repositoryClass: UserRepository::class)]
#[ORM\UniqueConstraint(name: 'UNIQ_IDENTIFIER_EMAIL', fields: ['email'])]
#[UniqueEntity(fields: ['email'], message: 'There is already an account with this email')]
class User implements UserInterface, PasswordAuthenticatedUserInterface
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 180)]
    private ?string $email = null;

    /**
     * @var list<string> The user roles
     */
    #[ORM\Column]
    private array $roles = [];

    /**
     * @var string The hashed password
     */
    #[ORM\Column]
    private ?string $password = null;

    #[ORM\Column(length: 255)]
    private ?string $username = null;

    #[ORM\Column]
    private bool $isVerified = false;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $pfp = null;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $bio = null;

    /**
     * @var Collection<int, subscriptions>
     */
    #[ORM\OneToMany(mappedBy: 'user', targetEntity: subscriptions::class, orphanRemoval: true)]
    private Collection $user;

    /**
     * @var Collection<int, subscriptions>
     */
    #[ORM\OneToMany(mappedBy: 'sub_user', targetEntity: subscriptions::class, orphanRemoval: true)]
    private Collection $sub_user;

    /**
     * @var Collection<int, mySubcribers>
     */
    #[ORM\OneToMany(mappedBy: 'user', targetEntity: mySubcribers::class, orphanRemoval: true)]
    private Collection $my_sub_user;

    /**
     * @var Collection<int, mySubcribers>
     */
    #[ORM\OneToMany(mappedBy: 'my_sub_user', targetEntity: mySubcribers::class, orphanRemoval: true)]
    private Collection $my_subs;

    #[ORM\OneToOne(mappedBy: 'user', cascade: ['persist', 'remove'])]
    private ?Feed $feed = null;

    /**
     * @var Collection<int, Video>
     */
    #[ORM\OneToMany(mappedBy: 'user', targetEntity: Video::class, orphanRemoval: true)]
    private Collection $videos;



    public function __construct()
    {
        $this->user = new ArrayCollection();
        $this->sub_user = new ArrayCollection();
        $this->my_sub_user = new ArrayCollection();
        $this->my_subs = new ArrayCollection();
        $this->videos = new ArrayCollection();
    }


    public function getId(): ?int
    {
        return $this->id;
    }



    public function getEmail(): ?string
    {
        return $this->email;
    }

    public function setEmail(string $email): static
    {
        $this->email = $email;

        return $this;
    }

    /**
     * A visual identifier that represents this user.
     *
     * @see UserInterface
     */
    public function getUserIdentifier(): string
    {
        return (string) $this->email;
    }

    /**
     * @see UserInterface
     */
    public function getRoles(): array
    {
        $roles = $this->roles;
        // guarantee every user at least has ROLE_USER
        $roles[] = 'ROLE_USER';

        return array_unique($roles);
    }

    /**
     * @param list<string> $roles
     */
    public function setRoles(array $roles): static
    {
        $this->roles = $roles;

        return $this;
    }

    /**
     * @see PasswordAuthenticatedUserInterface
     */
    public function getPassword(): ?string
    {
        return $this->password;
    }

    public function setPassword(string $password): static
    {
        $this->password = $password;

        return $this;
    }

    #[\Deprecated]
    public function eraseCredentials(): void
    {
        // @deprecated, to be removed when upgrading to Symfony 8
    }

    public function getUsername(): ?string
    {
        return $this->username;
    }

    public function setUsername(string $username): static
    {
        $this->username = $username;

        return $this;
    }

    public function isVerified(): bool
    {
        return $this->isVerified;
    }

    public function setIsVerified(bool $isVerified): static
    {
        $this->isVerified = $isVerified;

        return $this;
    }

    public function getPfp(): ?string
    {
        return $this->pfp;
    }

    public function setPfp(?string $pfp): static
    {
        $this->pfp = $pfp;

        return $this;
    }

    public function getBio(): ?string
    {
        return $this->bio;
    }

    public function setBio(?string $bio): static
    {
        $this->bio = $bio;

        return $this;
    }

    /**
     * @return Collection<int, subscriptions>
     */
    public function getUser(): Collection
    {
        return $this->user;
    }

    public function addUser(subscriptions $user): static
    {
        if (!$this->user->contains($user)) {
            $this->user->add($user);
            $user->setUser($this);
        }

        return $this;
    }

    public function removeUser(subscriptions $user): static
    {
        if ($this->user->removeElement($user)) {
            // set the owning side to null (unless already changed)
            if ($user->getUser() === $this) {
                $user->setUser(null);
            }
        }

        return $this;
    }

    /**
     * @return Collection<int, subscriptions>
     */
    public function getSubUser(): Collection
    {
        return $this->sub_user;
    }

    public function addSubUser(subscriptions $subUser): static
    {
        if (!$this->sub_user->contains($subUser)) {
            $this->sub_user->add($subUser);
            $subUser->setSubUser($this);
        }

        return $this;
    }

    public function removeSubUser(subscriptions $subUser): static
    {
        if ($this->sub_user->removeElement($subUser)) {
            // set the owning side to null (unless already changed)
            if ($subUser->getSubUser() === $this) {
                $subUser->setSubUser(null);
            }
        }

        return $this;
    }

    /**
     * @return Collection<int, mySubcribers>
     */
    public function getMySubUser(): Collection
    {
        return $this->my_sub_user;
    }

    public function addMySubUser(mySubcribers $mySubUser): static
    {
        if (!$this->my_sub_user->contains($mySubUser)) {
            $this->my_sub_user->add($mySubUser);
            $mySubUser->setUser($this);
        }

        return $this;
    }

    public function removeMySubUser(mySubcribers $mySubUser): static
    {
        if ($this->my_sub_user->removeElement($mySubUser)) {
            // set the owning side to null (unless already changed)
            if ($mySubUser->getUser() === $this) {
                $mySubUser->setUser(null);
            }
        }

        return $this;
    }

    /**
     * @return Collection<int, mySubcribers>
     */
    public function getMySubs(): Collection
    {
        return $this->my_subs;
    }

    public function addMySub(mySubcribers $mySub): static
    {
        if (!$this->my_subs->contains($mySub)) {
            $this->my_subs->add($mySub);
            $mySub->setMySubUser($this);
        }

        return $this;
    }

    public function removeMySub(mySubcribers $mySub): static
    {
        if ($this->my_subs->removeElement($mySub)) {
            // set the owning side to null (unless already changed)
            if ($mySub->getMySubUser() === $this) {
                $mySub->setMySubUser(null);
            }
        }

        return $this;
    }

    public function getFeed(): ?Feed
    {
        return $this->feed;
    }

    public function setFeed(Feed $feed): static
    {
        // set the owning side of the relation if necessary
        if ($feed->getUser() !== $this) {
            $feed->setUser($this);
        }

        $this->feed = $feed;

        return $this;
    }

    /**
     * @return Collection<int, Video>
     */
    public function getVideos(): Collection
    {
        return $this->videos;
    }

    public function addVideo(Video $video): static
    {
        if (!$this->videos->contains($video)) {
            $this->videos->add($video);
            $video->setUser($this);
        }

        return $this;
    }

    public function removeVideo(Video $video): static
    {
        if ($this->videos->removeElement($video)) {
            // set the owning side to null (unless already changed)
            if ($video->getUser() === $this) {
                $video->setUser(null);
            }
        }

        return $this;
    }

}
